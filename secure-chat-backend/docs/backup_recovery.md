# Secure Backup & Recovery

## Security Model
Backup allows recovery from device loss, but poses a risk if backups are leaked.
We mitigate this via **Client-Controlled Keys**.

## Recovery Phrase
- **Generated**: During onboarding. 24-word BIP39 mnemonic.
- **Storage**: NEVER stored on server in plaintext. Only a hash + salt is stored for verification.
- **Usage**:
    1.  Used to derive the **Backup Encryption Key** (AES-256-GCM).
    2.  Used to authenticate "Restore" requests on new devices.

## Backup Lifecycle
1.  **Creation**: User initiates. Server creates `backup_job`.
2.  **Encryption**: User client (or server acting on behalf with ephemeral key) encrypts data.
3.  **Storage**: Encrypted blob stored in `backup_blobs`.
4.  **Expiry**: Backups auto-delete after 30 days.

## Zero Knowledge
The server hosts the blob but cannot read it without the user's Recovery Phrase, which the server does not persist.
