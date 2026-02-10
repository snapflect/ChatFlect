# Secure Attachments Spec

## Security Model
- **End-to-End Encryption**: Server sees only `AES-256-GCM` ciphertext.
- **Key Management**: Keys are generated client-side, wrapped for recipients, and stored opaquely.
- **Integrity**: SHA256 of ciphertext enforced on upload.

## Protocol
1. **Upload**: 
   - Client: `New Key -> Encrypt File -> Hash Encrypted Blob`
   - API: `POST /media/upload (blob, hash, metadata)`
2. **Share**:
   - Client: `Encrypt Key with Recipient PubKey -> WrappedKey`
   - API: `POST /media/key (wrappedKey)` [Out-of-band or separate call, logic implied in message send usually]
   - *Note*: Our impl assumes Keys pushed to DB directly or via Message content. Current DB schema supports "Fanout" via `attachment_keys`.
3. **Download**:
   - Client: `GET /media/download?id=X` -> Blob
   - Client: `GET /media/key?id=X` -> Wrapped Key (Decrypts locally)

## Threat Model
- **Malicious Server**: Can delete files, but cannot read them (no key).
- **Interception**: TLS protects transport, AES-GCM protects data at rest.
