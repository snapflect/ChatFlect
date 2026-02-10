# Key Registration and Distribution Flow - ChatFlect

This document maps the cryptographic lifecycle of E2EE keys, focusing on how public keys are discovered and used to establish secure sessions across multiple devices.

## 1. Key Creation & Persistence
The initial point of trust starts on the device.

- **Generation**: Triggered in `AuthService.setSession` via `CryptoService.generateKeyPair()`.
- **Algorithm**: RSA-OAEP (2048-bit).
- **Private Key**: Immediately isolated in hardware-backed storage (`SecureStorageService`).
- **Public Key**: Exported as an SPKI string for publication.

---

## 2. Public Key Publication
The public key is published to the central directory to enable other users to initiate encrypted sessions.

- **Primary Storage**: The `users` table in MySQL stores a `public_key` (primarily for legacy/primary fallback).
- **Multi-Device Registry**: The `user_devices` table stores a `public_key` indexed by `device_uuid`.
- **Atomic Upsert**: Handled by `devices.php?action=register` using `ON DUPLICATE KEY UPDATE`.

---

## 3. Key Distribution (Discovery Flow)
When Alice wants to send a message to Bob, she must perform a "Key Discovery" to ensure all of Bob's devices can decrypt the message.

1.  **Directory Lookup**: `ChatService` calls `api.get('keys.php?user_id=BOB_UID')`.
2.  **Multicast Fetch**: The backend returns:
    - Bob's primary/legacy key.
    - An object (`devices`) mapping every registered `device_uuid` to its specific `public_key`.
3.  **Cross-Device Trust**: Alice treats every key returned by the backend as a valid destination for the session key.

---

## 4. Key Fan-out (Session Establishment)
Instead of encrypting the message body multiple times, ChatFlect uses a "Session Key Fan-out" strategy.

- **Step A**: Alice generates a random **AES-256-GCM Session Key**.
- **Step B**: Alice encrypts the message content once with this AES key.
- **Step C**: Alice encrypts the AES key itself for every one of Bob's (and her own) devices using their respective RSA Public Keys.
- **Step D**: The resulting message package contains a `keys` map:
  ```json
  {
    "keys": {
      "BOB_UID": {
        "primary": "RSA_ENCRYPTED_AES_KEY",
        "dev_uuid_1": "RSA_ENCRYPTED_AES_KEY"
      },
      "ALICE_UID": {
        "primary": "RSA_ENCRYPTED_AES_KEY",
        "dev_uuid_2": "RSA_ENCRYPTED_AES_KEY"
      }
    }
  }
  ```

---

## 5. Trust Data Model (Firestore)

| Path | Field | Purpose |
| :--- | :--- | :--- |
| `/chats/{chatId}/messages/{msgId}` | `ciphertext` | The AES-GCM encrypted message body. |
| `/chats/{chatId}/messages/{msgId}` | `iv` | The 12-byte initialization vector for AES. |
| `/chats/{chatId}/messages/{msgId}` | `keys` | The fan-out map of RSA-wrapped session keys. |

---

## 6. Security Summary & Assumptions

| Logic | Implementation | Security Benefit |
| :--- | :--- | :--- |
| **RSA-OAEP Padding** | Standardized OAEP padding used in `CryptoService`. | Protects against chosen-ciphertext attacks. |
| **Primary Fallback** | `keys.php` always returns a primary key if devices are missing. | Prevents communication blackout for legacy users. |
| **Encryption Isolation** | Only the session key is unique per device; content is global. | Minimizes bandwidth while maintaining per-device security. |

---

## 7. Security Considerations & Risks (Phase 1 Baseline)

| Risk ID | Title | Security Impact | Status |
| :--- | :--- | :--- | :--- |
| **🚨 E1** | **Backend Key Injection** | **Attacker can intercept/decrypt if server serves a malicious public key.** | **HIGH RISK; Requires Safety Numbers in Phase 2.** |
| **E2** | Key Pinning Absence | No detection if a user's primary key changes unexpectedly. | Baseline behavior; track in Risk Register. |
| **E3** | Key Exposure | Private keys in transit (even locally) or memory. | Isolated to hardware where supported. |

---

> [!CAUTION]
> **Risk E1** is the primary architectural dependency on the Backend's integrity. Until Phase 2 mitigations are implemented, the system is vulnerable to a compromised Public Key Directory.
