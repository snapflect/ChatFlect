# Web Storage Security (Epic 50)

## Security Model
To achieve parity with Android/iOS (Keystore-backed storage), the Web platform implements:

1.  **Encrypted-At-Rest**: All persistent data in IndexedDB/LocalStorage is AES-GCM encrypted.
2.  **Key Isolation**: Derives distinct keys for `messages`, `sessions`, and `registry` using HKDF.
3.  **Tamper Detection**: Authentication tags (GCM) ensure any modification of storage files leads to decryption failure (Fail-Secure).

## Schema
Records are stored as opacity blobs:
```json
{
  "id": "uuid",
  "ct": "base64...", // Ciphertext
  "iv": "base64...", // Unique IV
  "meta": {}         // Non-sensitive metadata only
}
```

## Key Management
- **Master Key**: Generated or derived from user credential/SRP. Stored in memory (or SessionStorage with heavy warning).
- **Storage Keys**: Derived via `StorageKDFService` (HKDF). Never persisted.

## Migration
Existing plaintext data is considered compromised and should be wiped on upgrade.
