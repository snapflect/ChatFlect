# Crypto Storage Map (TASK 1.2-B) - ChatFlect

This document maps cryptographic assets to their physical storage locations, detailing the protection mechanisms at each layer.

## 1. Client-Side Asset Storage

| Asset Class | Primary Storage | Fallback Storage | Protection Mechanism |
| :--- | :--- | :--- | :--- |
| **Private Keys** | iOS Keychain / Android Keystore | `secure_` localStorage | Native OS Encryption / AES-GCM (PBKDF2) |
| **Public Keys** | localStorage | N/A | Plaintext (Derived) |
| **Ratchet State** | localStorage | N/A | Plaintext JSON (Risk: Exposure) |
| **Media Blobs** | Native Cache Directory | Browser Blob Storage | AES-GCM Encrypted on Disk |
| **Auth Tokens** | localStorage | N/A | Plaintext Base64 |

---

## 2. Server-Side Asset Storage

| Asset Class | Storage Engine | Collection/Table | Visibility |
| :--- | :--- | :--- | :--- |
| **User Public Keys** | MySQL | `users.public_key` | Public Service Discovery |
| **Device Public Keys**| MySQL | `user_devices.public_key`| Public Service Discovery |
| **Encrypted Messages**| Firestore | `messages` | Auth-Gated (Recipient/Sender) |
| **Refresh Tokens** | MySQL | `user_sessions.token` | Server-Internal |

---

## 3. Storage Protection Deep-Dive

### A. Capacitor Secure Storage (Mobile)
- **Mechanism**: Uses `capacitor-secure-storage-plugin`.
- **Backend**: 
    - **iOS**: Keychain services.
    - **Android**: Shared Preferences backed by Android KeyStore.
- **Exposure**: Private keys remain encrypted at rest via hardware-backed modules where available.

### B. Encrypted localStorage (Web Fallback)
- **Mechanism**: Custom Implementation in `SecureStorageService`.
- **Derivation**: `PBKDF2` with 100,000 iterations.
- **Salt**: `ChatFlect_SecureStorage_Salt`.
- **Input**: Device Fingerprint (UserAgent, Screen Size, Language).
- **Encryption**: `AES-GCM-256`.
- **Risk**: Device fingerprints can be low-entropy, making the storage wrap vulnerable to offline brute-force if the `localStorage` is dumped.

### C. Media Cache Persistence
- **Mechanism**: `SecureMediaService` + `Filesystem`.
- **Directory**: `Directory.Cache`.
- **Integrity**: Verified via `ETag` matching against the backend before serving.
- **Zeroization**: Cache is zeroed out and purged on **Logout** or **Remote Kill**.

---

## 4. Identified Storage Vulnerabilities (Phase 2)

1.  **Ratchet State Plaintext**: Conversation ratchets (Chain keys) are currently stored in `localStorage` without additional wrapping.
2.  **Backup Exposure**: The JSON backup feature manually extracts keys from `localStorage` and places them in a plaintext file (Risk H2).
3.  **Auth Token Storage**: PHP `id_token` and `refresh_token` are stored in plaintext `localStorage`, allowing for session hijacking if an XSS vulnerability exists.
