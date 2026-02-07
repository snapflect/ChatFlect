# Signed Key Bundle Specification (ChatFlect v2.0)

> **Status**: DRAFT
> **Version**: 1.0
> **Date**: 2026-02-07

## 1. Overview

To prevent Man-in-the-Middle (MITM) attacks and backend key injection, ChatFlect v2.0 introduces **Signed Key Bundles**. This mechanism ensures that clients only trust public keys that have been explicitly signed by the ChatFlect Identity Authority (Backend).

### Vulnerability Addressed
**E1 (Backend Key Injection)**: An attacker with database access or compromise of the API could replace a user's public key with their own, intercepting all future messages. Signed bundles prevent this by requiring a valid signature from the separate signing key.

---

## 2. Key Bundle Structure

The `KeyBundle` is a JSON object containing the user's identity, device information, public key, and a cryptographic signature.

### Schema

```json
{
  "user_id": "U123456",
  "device_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "public_key": "MIIBIjANBgkqhki...",
  "timestamp": "2026-02-07T12:00:00Z",
  "version": 2,
  "signature": "HexEncodedSignature..."
}
```

### Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `user_id` | String | The immutable user ID of the key owner. |
| `device_uuid` | String | The unique device ID bound to this key. |
| `public_key` | String | The RSA-2048 public key (PEM or Base64). |
| `timestamp` | String | ISO 8601 creation time. Prevents replay of old keys. |
| `version` | Integer | Protocol version (must be >= 2). |
| `signature` | String | RSASSA-PKCS1-v1_5 SHA-256 signature of the canonical payload. |

---

## 3. Signing Process (Backend)

The backend maintains a secure **Identity Signing Key** (RSA-2048 or Ed25519). This key is distinct from any user keys.

1.  **Canonicalization**: Create the signing payload string.
    Format: `user_id|device_uuid|public_key|timestamp|version`
    Example: `U123|uuid-555|MII...|2026-02-07T12:00:00Z|2`
    
2.  **Signing**: Sign the payload using the backend's private key.
    Algorithm: `SHA-256` + `RSA` (or `Ed25519`).
    
3.  **Encoding**: Encode the binary signature as a Hex string.

4.  **Storage**: Valid keys are stored in the database with their signature.

---

## 4. Verification Process (Client)

Clients must perform verification before using any downloaded public key.

1.  **Fetch**: Retrieve the bundle from `/api/keys.php`.
2.  **Reconstruct**: Reconstruct the canonical payload string from the JSON fields.
3.  **Verify**: Verify the `signature` against the payload using the **Backend Public Identity Key** (hardcoded or securely fetched).
4.  **Validate**:
    *   Check `user_id` matches the expected recipient.
    *   Check `timestamp` is recent (optional, or just strictly monotonic).
5.  **Trust**: If verification fails, **discard the key** and abort encryption.

---

## 5. Key Rotation

*   **Signing Key**: The backend public key should be pinned in the client application. Rotation requires an app update or a secure proprietary delivery channel.
*   **User Keys**: When a user rotates their device key, a new bundle is generated and signed by the backend.

---

## 6. Implementation Plan / Roadmap

*   **Phase 2 Sprint 2**: Implement basic server-side signing and client verification.
*   **Phase 3**: Key Transparency Log (public append-only log of all key changes).
