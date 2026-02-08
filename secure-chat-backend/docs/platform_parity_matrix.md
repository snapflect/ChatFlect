# ChatFlect Platform Parity Matrix
**Epic 46: Multi-Platform Security Contract**

This document defines the required security and behavioral parity across all ChatFlect platforms.
**Platforms**: Android, iOS, Web
**Rule**: No platform may ship with weaker security guarantees than another platform.

---

## 1. Crypto Parity
| Capability | Android | iOS | Web | Notes |
|---|---|---|---|---|
| **Key Generation** | REQUIRED | REQUIRED | REQUIRED | Must use platform secure RNG |
| **Forward Secrecy** | REQUIRED | REQUIRED | REQUIRED | Signal-aligned ratchet |
| **Replay Protection** | REQUIRED | REQUIRED | REQUIRED | Duplicate nonce/messageId rejection |
| **Ciphertext Integrity** | REQUIRED | REQUIRED | REQUIRED | Tamper rejection (AEAD) |
| **Message Auth** | REQUIRED | REQUIRED | REQUIRED | Signature verification |
| **Sender Keys** | REQUIRED | REQUIRED | REQUIRED | Group optimization |

---

## 2. Storage Parity
| Capability | Android | iOS | Web | Notes |
|---|---|---|---|---|
| **Plaintext Storage** | FORBIDDEN | FORBIDDEN | FORBIDDEN | Strictly prohibited |
| **Encrypted Storage** | REQUIRED | REQUIRED | REQUIRED | SQLCipher / Encrypted IndexedDB |
| **Key Storage** | REQUIRED | REQUIRED | REQUIRED | Keystore / Keychain / Encrypted IDB |

---

## 3. Device Trust Parity
| Capability | Android | iOS | Web | Notes |
|---|---|---|---|---|
| **Safety Number** | REQUIRED | REQUIRED | REQUIRED | Visual fingerprint comparison |
| **Key Change Warn** | REQUIRED | REQUIRED | REQUIRED | Blocking warning on identity change |
| **Device Revocation** | REQUIRED | REQUIRED | REQUIRED | Immediate access cut-off |

---

## 4. Offline / Sync Parity
| Capability | Android | iOS | Web | Notes |
|---|---|---|---|---|
| **Offline Queue** | REQUIRED | REQUIRED | REQUIRED | Retry-safe logic |
| **Repair Protocol** | REQUIRED | REQUIRED | REQUIRED | Gap detection & filling |
| **Read Receipts** | REQUIRED | REQUIRED | REQUIRED | Sync convergence |

---

## 5. Security Invariants
See `security_invariants.md` for strict non-negotiable rules enforced by CI.
