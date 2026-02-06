# Crypto Storage Map (TASK 1.2-C) - ChatFlect

This document provides a definitive map of all cryptographic asset storage locations, detailing their protection mechanisms and exposure risks.

## 1. Cryptographic Storage Matrix

| Asset Name | Storage System | Encryption at Rest | Sensitivity (1-10) | Exposure Risk | Access Boundary |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Master Private Key** | SecureStorage (Keychain) | ✅ (Hardware) | 10 | LOW | Client-Only |
| **Master Private Key** | localStorage (Fallback) | ✅ (AES-GCM) | 10 | MED | Client-Only |
| **Master Private Key** | **Backup JSON Export** | ❌ **Plaintext** | 10 | **CRITICAL** | User-Exported |
| **Ratchet State** | localStorage | ❌ **Plaintext** | 8 | **HIGH** | Client-Only |
| **Device Public Key** | MySQL (`user_devices`) | ❌ (Public) | 2 | LOW | Public Plane |
| **Offline Outbox** | SQLite (SQLCipher) | ✅ (AES-256) | 7 | LOW | Client-Only|
| **Auth Tokens** | localStorage | ❌ **Plaintext** | 6 | **HIGH** | Client-Only |
| **Encrypted Blobs** | Native Cache Dir | ✅ (AES-GCM) | 5 | LOW | Client-Only |
| **Message Payloads** | Firestore (`messages`) | ✅ (E2EE) | 9 | LOW | Converged |

---

## 2. Storage System Deep-Dive

### A. SecureStorageService (Mobile)
- **Primary**: Uses `capacitor-secure-storage-plugin` for raw RSA private keys and the SQLite passphrase.
- **Hardware Binding**: Leverages TEE (Trusted Execution Environment) on Android and Secure Enclave on iOS.
- **Access**: Strictly scoped to the application sandbox.

### B. SQLite Outbox (Persistent)
- **Engine**: `@capacitor-community/sqlite` with full-disk encryption.
- **Key Storage**: The 32-byte database passphrase is stored in `SecureStoragePlugin`.
- **Content**: Encrypted E2EE payloads waiting for network restoration.

### C. localStorage (Web/Hybrid)
- **Unwrapped State**: Ratchet chain keys and session tokens are stored in standard `localStorage`.
- **Wrapped State**: The `private_key` is wrapped using `AES-GCM-256` derived from a device fingerprint via PBKDF2 (100k iterations).
- **Risk**: Susceptible to XSS, allowing for "Ratchet Advancement" or "Session Hijacking".

### D. Backup JSON Export
- **Format**: Plaintext JSON file.
- **Content**: Contains the raw `private_key`.
- **Risk**: If the user saves this to unencrypted cloud storage or a shared drive, the entire identity is lost.

---

## 3. Sensitivity Ratings & Access Boundaries

- **Identity Layer (Rating 10)**: Master Private Key. **Critical Boundary**: Must never leave the device unless wrapped by a user-provided password (not currently implemented).
- **Session Layer (Rating 7-9)**: Ratchet State & Message Payloads. **Boundary**: Multi-device converged view.
- **Transport Layer (Rating 6)**: Auth Tokens. **Boundary**: Front-to-Back signaling.

---

## 4. Compliance Verification

- [x] Includes `SecureStorageService`, `localStorage`, `SQLite`, `Firestore`, `MySQL`, and `Backup JSON`.
- [x] Risk ratings (LOW/MED/HIGH/CRITICAL) assigned based on current architecture.
- [x] Sensitivity ratings (1-10) assigned to all critical assets.
- [x] Access boundaries (Client-Only / Converged / Public) defined.
