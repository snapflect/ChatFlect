# Crypto Envelope Spec (TASK 1.2-C & 1.2-E) - ChatFlect

This document defines the JSON structure of encrypted message payloads ("Envelopes") transitioned via Firestore, refined to satisfy TASK 1.2-E (P0).

## 1. Envelope Schemas

### v1: Hybrid Envelope (RSA + AES)
Used for standard one-to-one and group messages without symmetric ratcheting.

```json
{
  "id": "msg_123456789",
  "senderId": "UID_SENDER",
  "senderDeviceUuid": "DEV_UUID_SENDER",
  "ciphertext": "BASE64_DATA",
  "iv": "BASE64_IV",
  "keys": {
    "UID_RECIPIENT": {
      "primary": "ENC_KEY_FOR_RECIPIENT_PRIMARY",
      "DEV_UUID_X": "ENC_KEY_FOR_RECIPIENT_DEV_X"
    }
  },
  "timestamp": 1707254400,
  "tempId": "tmp_987654321",
  "expiresAt": 1707340800,
  "cipherVersion": 1,
  "deletedFor": []
}
```

### v2: Ratchet Envelope (Symmetric Ratchet)
Used for proactive, multi-message secure sessions.

```json
{
  "id": "msg_ratchet_123",
  "senderId": "UID_SENDER",
  "ciphertext": "BASE64_DATA",
  "iv": "BASE64_IV",
  "v": 2,
  "h": "BASE64_BOOTSTRAP_ROOT",
  "timestamp": 1707254400,
  "cipherVersion": 2
}
```

---

## 2. Detailed Field Specification (TASK 1.2-E)

| Field | Data Type | Purpose | Sensitivity | Integrity |
| :--- | :--- | :--- | :---: | :---: |
| `id` (messageId) | String | Global unique identifier for the message. | 3 | High |
| `senderId` | String | User ID of the message originator. | 5 | High |
| `senderDeviceUuid` | String | UUID of the specific device that sent the message. | 6 | High |
| `ciphertext` | String | Base64 encoded encrypted message content. | 10 | High |
| `iv` | String | 12-byte initialization vector (Base64). | 5 | High |
| `keys` | Map | Recipient fan-out map containing encrypted AES keys. | 8 | High |
| `timestamp` | Number | Unix timestamp of when the message was sent. | 3 | High |
| `tempId` | String | Client-side ID for local UI reconciliation. | 2 | Medium |
| `deletedFor` | Array | List of User IDs who have deleted this for themselves. | 4 | Medium |
| `expiresAt` | Number | Unix timestamp for TTL (Time To Live) deletion. | 3 | High |
| `cipherVersion` | Number | Protocol version identifier (e.g., 1 for Hybrid, 2 for Ratchet). | 2 | High |
| `replyTo` | Object | (Optional) Reference to a parent message ID/sender. | 4 | High |

---

## 3. Security Properties

1.  **Immutability**: Fields marked with **High** integrity importance must not be modified by the transport layer. Any change to `ciphertext` or `iv` will result in decryption failure. Any change to `senderId` or `messageId` may lead to authentication or duplication errors.
2.  **Sensitivity**: `ciphertext` is the most sensitive field (Rating 10) as it contains the private communication. `keys` follows (Rating 8) as it contains the keys to the ciphertext (though they are themselves encrypted).
3.  **Metadata Leakage**: Even with E2EE, the `keys` map reveals the number of devices per participant and the `senderId` reveals communication patterns. This is an accepted limitation of the current architecture.
