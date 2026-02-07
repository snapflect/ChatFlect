# ChatFlect Crypto Specification v1.0

**Version:** 1.0
**Status:** Approved
**Date:** 2026-02-07

## 1. Executive Summary
This specification defines the cryptographic architecture for ChatFlect, transitioning from legacy RSA encryption to the **Signal Protocol** (Double Ratchet + X3DH) for 1:1 messaging. It introduces a **Hybrid Migration Bridge** to support legacy clients and group chats while enabling perfect forward secrecy (PFS) and post-compromise security (PCS) for supported sessions.

## 2. Cryptographic Primitives
ChatFlect utilizes the following primitives provided by `libsignal-protocol-typescript`:

| Purpose | Algorithm | Curve/Parameter |
| :--- | :--- | :--- |
| **Identity Keys** | Ed25519 | Curve25519 |
| **Key Agreement** | X3DH (Extended Triple Diffie-Hellman) | Curve25519 |
| **Encryption** | AES-256-GCM | 256-bit Key |
| **Authentication** | HMAC-SHA256 | - |
| **Signatures** | EdDSA | Curve25519 |

## 3. Protocol Architecture

### 3.1 1:1 Messaging (Signal Protocol V3)
*   **Session Establishment**: Asynchronous setup using PreKeys (X3DH).
*   **Ratchet**: Double Ratchet Algorithm updates chain keys for every message.
*   **Addressing**: Messages are addressed to `(UserId, DeviceId)`.

### 3.2 Hybrid Migration Bridge (Story 2.5)
To maintain backward compatibility and support multi-device syncing without re-encryption access:
*   **Dual Ciphertext Storage**:
    *   `ciphertext_to_receiver`: Encrypted for the recipient's active device.
    *   `ciphertext_to_sender`: Encrypted for the sender's own device (Note-to-Self).
*   **Fallback**: If a recipient is not Signal-capable (missing `libsignal_device_id`), the system falls back to legacy RSA-2048 (with user warning).

## 4. Message Envelope Schema (V3)
Messages stored in Firestore follow the `v3` protocol schema:

```json
{
  "id": "msg_uuid",
  "protocol": "v3",
  "type": "signal",
  "messageType": "PREKEY" | "WHISPER",
  "senderUserId": "alice",
  "senderDeviceId": 1,
  "receiverUserId": "bob",
  "receiverDeviceId": 2, // Resolved via Backend
  "timestamp": 1678900000,
  
  "ciphertext_to_receiver": {
    "type": 3,
    "body": "base64_payload",
    "registrationId": 12345
  },
  "ciphertext_to_sender": {
    "type": 1,
    "body": "base64_payload",
    "registrationId": 67890
  }
}
```

## 5. Key Management (Server-Side)

### 5.1 PreKey Server API
*   `POST /v3/keys`: Upload Identity Key, Signed PreKey, and OTPK batch.
*   `GET /v3/keys`: Fetch pre-key bundle for a target user/device.
*   `GET /devices`: Discover active devices for a user.

### 5.2 Key Lifecycle
*   **Signed PreKeys**: Rotated periodically (e.g., weekly) to provide PCS for new sessions. Signed by Identity Key.
*   **One-Time PreKeys**: Consumed upon session initiation. Server replenishes when low.
*   **Identity Keys**: Immutable (Trust On First Use). Changes trigger "Safety Number Change" warnings.

## 6. Device Management
*   **Discovery**: Authenticated users can query `GET /devices` to resolve `libsignal_device_id` for recipients.
*   **Registration**: Devices are assigned a unique, auto-incrementing integer ID per user upon registration.
*   **Limit**: Max 5 devices per user (FIFO eviction).

## 7. Security Policy
*   **Downgrade Protection**: Fallback to Legacy RSA is **blocked** if a Signal session exists or if an Identity Mismatch is detected.
*   **Replay Protection**: Handled by Signal's internal message counter/ratchet state.
*   **Metadata**: Chat metadata (last message snippet) remains encrypted with Legacy RSA (shared key) for list view performance, pending "Sealed Sender" implementation.
