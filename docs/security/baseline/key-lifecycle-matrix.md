# Key Lifecycle Matrix (TASK 1.2-E) - ChatFlect

This document defines the operational lifecycle stages for every critical cryptographic key in the system.

## 1. Lifecycle Matrix

| Key Type | Generation Trigger | Rotation Policy | Revocation Trigger | Storage Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Master RSA (Private)**| First Login / Device Provisioning | Manual (User Triggered) | Device Revocation / Logout | SecureStore (Encrypted) |
| **Master RSA (Public)** | First Login / Device Provisioning | Manual (Sync with Priv) | Device Revocation | MySQL (Plaintext) |
| **Ratchet Root Key** | First Message in Session | None (Per-Session) | Session Conflict / Reset | localStorage (Plaintext) |
| **Chain Key (Send/Recv)**| Every Message Send/Recv | Automatic (KDF Step) | Never (Ephemeral) | localStorage (Plaintext) |
| **AES Session Key (v1)**| Every Message Send | None (One-time) | Never (Ephemeral) | Memory Only |
| **Media Key** | Every Media Upload | None (Per-Asset) | Asset Expiry/Deletion | Firestore (Encrypted) |

---

## 2. Generation Procedures

1.  **Identity Keys**: Generated during `verifyOtp` using `window.crypto.subtle.generateKey` ("RSA-OAEP").
2.  **Ratchet Initiation**: In `encryptWithRatchet`, if no session exists, a 32-byte `rootKey` is generated via `getRandomValues`.
3.  **Media Keys**: Generated in `encryptBlob` before upload; the key is then encrypted with the recipient's RSA public key.

---

## 3. Rotation & Renewal Mechanics

- **Manual Key Rotation**: `AuthService.rotateKeys()` generates a new pair and updates the backend via `devices.php?action=register`. 
    - *Limitation*: Rotating keys does not update existing Ratchet sessions, which may lead to decryption gaps.
- **Ratchet Stepping**: Every message processed by `kdfChain` derives a new `nextChainKey` and a `messageKey`, effectively rotating the active encryption key forward (Forward Secrecy).
- **Token Rotation**: `refresh_token.php` implements rotation on every use (new token issued, old one deleted).

---

## 4. Revocation & Disposal

- **Local Wipe**: `AuthService.logout()` executes a full `localStorage.clear()` and wipes the Private Key from the SecureStorage.
- **Backend Sync**: `devices.php?action=delete` removes the public key from the global directory, preventing new messages from being fan-out to that device.
- **Zeroization**: `SecureMediaService` attempts to `fill(0)` buffers of sensitive media keys after usage and before garbage collection.

---

## 5. Identified Lifecycle Gaps (Phase 2)

1.  **No Automatic RSA Rotation**: Identity keys are static unless the user manually triggers a rotation or logs out/reinstalls.
2.  **No Key History**: The backend only stores the *current* public key. If a user rotates their keys, they lose access to all messages encrypted with the previous key.
3.  **Weak Private Key Disposal**: If a user uninstalls the app without a "Logout", the private key may remain in the OS Keychain/Keystore indefinitely.
