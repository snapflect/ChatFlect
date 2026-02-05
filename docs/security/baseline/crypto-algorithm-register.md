# Crypto Algorithm Register (TASK 1.2-F) - ChatFlect

This document lists the exact cryptographic primitives and implementation parameters used throughout the application.

## 1. Asymmetric Encryption

| Primitive | Operation | Hash | implementation | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **RSA-OAEP** | Encrypt/Decrypt| SHA-256 | WebCrypto API | Asymmetric key transit & Handshakes |

- **Key Size**: 2048-bit.
- **Public Exponent**: 65537 (`0x010001`).

---

## 2. Symmetric Encryption

| Primitive | Operation | Key Size | Mode | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **AES-GCM** | Encrypt/Decrypt| 256-bit | GCM | Authenticated payload encryption |

- **IV Size**: 96-bit (12 bytes).
- **Tag Size**: 128-bit (Standard GCM tag).

---

## 3. Key Derivation & Hashing

| Primitive | Operation | Hash | Parameters | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **HKDF** | Extract/Expand | SHA-256 | RFC 5869 | Ratchet state derivation |
| **PBKDF2** | Derive Key | SHA-256 | 100,000 Iterations | Storage wrap key (Web fallback) |
| **HMAC** | Sign/Verify | SHA-256 | 256-bit Key | Message integrity & PRK extraction |

---

## 4. Randomness & Entropy

- **Source**: `window.crypto.getRandomValues()` (WebCrypto API).
- **Usage**:
    - AES IV generation.
    - Ratchet Root Key generation.
    - Session ID (JTI) generation for tokens.

---

## 5. Implementation Compliance (Phase 2 Focus)

1.  **Fips 140-2 Considerations**: The app relies on the browser/system WebCrypto implementation. On mobile platforms, this typically maps to secure hardware-backed providers (OpenSSL/BoringSSL).
2.  **Quantum Resistance**: Current implementations (RSA-2048) are not quantum-resistant. Future roadmap items in Phase 4 may explore PQC (Post-Quantum Cryptography).
3.  **Key Serialization**: Keys are exported/stored using `spki` (Public) and `pkcs8` (Private) formats, then Base64 encoded for transit.
