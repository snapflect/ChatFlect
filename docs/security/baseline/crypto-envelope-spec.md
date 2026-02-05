# Crypto Envelope Spec (TASK 1.2-C) - ChatFlect

This document defines the JSON structure of encrypted message payloads ("Envelopes") transitioned via Firestore.

## 1. v1: Hybrid Envelope (RSA + AES)

Used for historical messages and non-ratchet communication.

```json
{
  "k": "BASE64_ENCRYPTED_AES_KEY", 
  "i": "BASE64_IV",
  "d": "BASE64_CIPHERTEXT"
}
```

| Field | Name | Content | Protection |
| :--- | :--- | :--- | :--- |
| `k` | Key | AES-256 session key | RSA-OAEP Encrypted (Recipient PK) |
| `i` | IV | 12-byte initialization vector | Plaintext Base64 |
| `d` | Data | Encrypted Message Payload | AES-GCM Encrypted |

---

## 2. v2: Ratchet Envelope (Symmetric Ratchet)

Used for proactive, multi-message secure sessions.

```json
{
  "v": 2,
  "i": "BASE64_IV",
  "d": "BASE64_CIPHERTEXT",
  "h": "BASE64_ENCRYPTED_ROOT_KEY" [OPTIONAL]
}
```

| Field | Name | Content | Protection |
| :--- | :--- | :--- | :--- |
| `v` | Version | Integer `2` | Plaintext |
| `i` | IV | 12-byte initialization vector | Plaintext Base64 |
| `d` | Data | Encrypted Message Payload | AES-GCM (Ratchet Message Key) |
| `h` | Header | Bootstrap Root Key (Shared Secret)| RSA-OAEP Encrypted |

> [!NOTE]
> The `h` field is only present in the first message of a Ratchet session to establish the shared root.

---

## 3. v16.0: Integrity Overlay (HMAC)

Used to wrap both `v1` and `v2` envelopes if Integrity Signing is enabled.

```json
{
  "m": "STRING_SERIALIZED_ENVELOPE",
  "s": "BASE64_HMAC_SIGNATURE"
}
```

| Field | Name | Content | Protection |
| :--- | :--- | :--- | :--- |
| `m` | Message | The full v1 or v2 JSON string | Plaintext (Nested Envelope) |
| `s` | Signature| SHA-256 HMAC of the `m` field | HMAC-SHA256 (Shared Signing Key)|

---

## 4. Recipient Fan-out Schema

In multi-device scenarios, the `keys` map in the Firestore message document resolves the `k` (or `h`) field for each device.

```json
{
  "keys": {
    "DEVICE_UUID_1": "ENCRYPTED_KEY_FOR_DEVICE_1",
    "DEVICE_UUID_2": "ENCRYPTED_KEY_FOR_DEVICE_2"
  },
  "text": { ...ENVELOPE... }
}
```

---

## 5. Security Insights

1.  **IV Non-reusability**: The system generates a fresh random 12-byte IV for every message (`window.crypto.getRandomValues`).
2.  **Malleability**: v1 envelopes lack inherent MAC protection outside of the GCM tag. The v16.0 overlay was introduced to mitigate tampering.
3.  **Envelope Bloat**: Multi-device fan-out grows the `keys` map linearly, increasing document size and revealable metadata (Device count).
