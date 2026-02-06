# Crypto Algorithm Register (TASK 1.2-D) - ChatFlect

This document serves as the formal register of all cryptographic algorithms, parameters, and configurations used in the ChatFlect system.

## 1. Cryptographic Register

| Algorithm | Key Size | Mode / Padding | Usage Location | Justification |
| :--- | :--- | :--- | :--- | :--- |
| **RSA-OAEP** | 2048-bit | SHA-256 Padding | Client (E2EE) | Industry standard for hybrid key transit. NIST SP 800-56B. |
| **AES-GCM** | 256-bit | 96-bit (12B) IV | Client/Outbox/Cache | Authenticated encryption (AEAD). High security margin. |
| **PBKDF2** | 256-bit Key | 100k Iterations | Client (Web Fallback) | Mitigation against offline brute-force for storage wrap. |

> [!NOTE]
> **Phase 2 Improvement**: Currently uses a static namespace salt. Phase 2 should introduce a per-device random salt stored alongside ciphertext to maximize entropy and brute-force resistance.

| **HKDF** | N/A | SHA-256 (Extract/Expand) | Client (Ratchet) | Deterministic key derivation for symmetric rachets. |
| **HMAC** | 256-bit | SHA-256 | Backend (Tokens) | Fast, secure integrity checks for JWT signatures. |
| **SHA-256** | N/A | N/A | Global (Fingerprinting) | Collision-resistant hashing for device/key identity. |

---

## 2. Technical Configuration Details

### A. Random Number Generation (RNG)
- **Primary Source**: `window.crypto.getRandomValues()`.
- **Implementation**: Used for all AES IVs, Ratchet Root Keys, and cryptographically secure session identifiers (JTIs).
- **Compliance**: Standards-based CSPRNG (Cryptographically Secure Pseudo-Random Number Generator).

### B. Storage KDF (PBKDF2)
- **Iterations**: 100,000.
- **Hashing**: SHA-256.
- **Salt**: `ChatFlect_SecureStorage_Salt` (Static, used to distinguish storage scopes).
- **Fallback Entropy**: Device fingerprint (UserAgent, Screen Size, Language, Timezone).

### C. RSA Padding Specification
- **Mode**: OAEP (Optimal Asymmetric Encryption Padding).
- **Mask Generation Function**: MGF1 with SHA-256.
- **Public Exponent**: 65537 (standard).

---

## 3. Security Assessment

### Flagged Weak Algorithms
- **MD5 / SHA-1**: **None detected**. Only SHA-256+ used.
- **RSA-1024**: **None detected**. All identity keys are 2048-bit.
- **ECB Mode**: **None detected**. GCM mode used exclusively for symmetric encryption.

### Roadmap (Phase 4)
- Post-Quantum Cryptography (PQC) evaluation for long-term forward secrecy.
- Migration to RSA-4096 or Ed25519 (ECC) for improved performance/security ratio.

---

## 4. Compliance Verification

- [x] Includes AES-GCM key/IV size.
- [x] Includes RSA key size and padding mode.
- [x] Includes hashing function for fingerprints (SHA-256).
- [x] Includes PBKDF2 iterations (100,000).
- [x] Includes random generator source (`window.crypto`).
- [x] All implementations verified against source code (`CryptoService.ts`).
