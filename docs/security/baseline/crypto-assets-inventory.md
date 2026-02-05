# Crypto Assets Inventory (TASK 1.2-A) - ChatFlect

This document catalogs every cryptographic key type used within the ChatFlect ecosystem, defining its function, algorithm, and ownership.

## 1. Identity & Long-Term Keys

These keys represent the persistent identity of the user and their specific devices.

| Key Name | Algorithm | Bits | Function | Owner | Persistency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Master Private Key** | RSA-OAEP | 2048 | Decrypting session keys & Handshakes | Client (Device) | Persistent |
| **Master Public Key** | RSA-OAEP | 2048 | Encrypting session keys for user | Backend (Public) | Persistent |
| **Integrity Key** | HMAC-SHA256 | 256 | Signing/Verifying message authenticity | Client (Device) | Persistent |

---

## 2. Ephemeral & Session Keys

These keys are generated dynamically to secure specific conversations or media transfers.

| Key Name | Algorithm | Bits | Function | Owner | Persistency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **v1 Hybrid Key** | AES-GCM | 256 | Encrypting message data in legacy mode | Client (Converged)| Per-Message |
| **v2 Ratchet Key** | AES-GCM | 256 | Encrypting message data in Ratchet mode| Client (Converged)| One-Time Use |
| **Media Key** | AES-GCM | 256 | Encrypting Blobs (Images/Video/PDF) | Client (Converged)| Per-Media |
| **Sync Handshake Key**| RSA-OAEP | 2048 | Securing the Mirroring session (QR) | Client (Mirror) | Ephemeral |

---

## 3. Derived Keys & PRFs

Keys generated from existing entropy to secure specific layers.

| Key Name | Algorithm | Bits | Function | Source | Persistency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Storage Wrap Key** | AES-GCM | 256 | Encrypting localStorage fallbacks | PBKDF2 (Fingerprint)| Device-Specific|
| **Root Key (Ratchet)**| HKDF-SHA256 | 256 | Master secret for Symmetric Ratchet | RSA Handshake | Per-Session |
| **Chain Key (Send)** | HKDF-SHA256 | 256 | Ratchet state for sending | Root Key | Volatile |
| **Chain Key (Recv)** | HKDF-SHA256 | 256 | Ratchet state for receiving | Root Key | Volatile |

---

## 4. Trust Summary

1.  **Client-Only Entropy**: All RSA and AES-GCM keys are generated exclusively on the client using `window.crypto.getRandomValues`.
2.  **No Server-Side Private Keys**: The backend never generates or stores private key material for users.
3.  **Public Key Registry**: The `user_devices` table in MySQL serves as the definitive registry for device public keys.
