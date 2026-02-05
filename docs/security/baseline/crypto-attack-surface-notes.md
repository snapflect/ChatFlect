# Crypto Attack Surface Notes (TASK 1.2-G) - ChatFlect

This document identifies the specific attack vectors targeting the cryptographic implementation of ChatFlect.

## 1. Key Material Exposure Vectors

| Vector ID | Description | Root Cause | Impact |
| :--- | :--- | :--- | :--- |
| **V1.1** | **Private Key Extraction** | Plaintext Master Private Key in unencrypted JSON backups. | Total identity compromise. |
| **V1.2** | **Storage Wrap Bypass** | Low-entropy fingerprints make the PBKDF2 wrap vulnerable to brute-force. | Access to encrypted `localStorage`. |
| **V1.3** | **Ratchet State Exposure** | Symmetric chain keys stored in plaintext `localStorage`. | Loss of future secrecy for current sessions. |

---

## 2. Protocol & Trust Violations

| Vector ID | Description | Root Cause | Impact |
| :--- | :--- | :--- | :--- |
| **V2.1** | **Public Key Injection** | Backend replaces a user's `publicKey` in the MySQL directory. | MITM (Attacker receives future E2EE keys). |
| **V2.2** | **Token/Session Hijacking**| Plaintext `id_token` / `refresh_token` in `localStorage`. | Persistent account takeover via XSS. |
| **V2.3** | **Media Metadata Retrieval**| Knowledge of `upload.php` URL structure allows file discovery. | Leakage of encrypted blobs (Ciphertext exposure). |

---

## 3. Trust Boundaries Analysis

### Boundary 1: Client Application (T1)
- **Trust Level**: High (Sovereign).
- **Assumed Control**: Secure RNG, Secure Key Storage (Mobile), Frame Isolation (XSS Protection).
- **Vulnerability**: If the Sandbox is breached via XSS, the `CryptoService` can be forced to export keys or decrypt content.

### Boundary 2: Backend Control Plane (T2)
- **Trust Level**: Semi-Trusted (Signaling Only).
- **Assumed Control**: Auth Token verification, Rate limiting.
- **Violation Risk**: If T2 is compromised, it can disrupt discovery (V2.1) but *cannot* decrypt existing message history (due to E2EE).

### Boundary 3: External Infrastructure (T3) - Firestore/Google
- **Trust Level**: Untrusted (Storage Only).
- **Assumed Control**: Persistence.
- **Violation Risk**: T3 can see conversation graphs (who talks to whom) and document metadata, but is blind to the `text` and `keys` content.

---

## 4. Mitigation Strategies (Phase 2 Roadmap)

1.  **Signed Key Bundles**: Require the client to sign their Public Key with their Identity Key, preventing the backend from injecting unsigned rogue keys (Mitigates V2.1).
2.  **Encrypted Backups**: Mandate a user password for `PBKDF2` derivation during the JSON export process (Mitigates V1.1).
3.  **HTTP-Only Cookies**: Move PHP session tokens from `localStorage` to `HttpOnly` cookies to prevent XSS-based hijacking (Mitigates V2.2).
4.  **Hardware-Backed Storage**: Force the use of Native Keychain/Keystore for all session metadata, not just the RSA key.
