# ChatFlect Platform Parity Matrix
**Epic 46: Multi-Platform Security Contract**

This document defines the required security and behavioral parity across all ChatFlect platforms.
**Platforms**: Android, iOS, Web
**Rule**: No platform may ship with weaker security guarantees than another platform.

---

## 1. Crypto Parity
| Capability | Required | Android | iOS | Web | Status | Notes |
|---|---|---|---|---|---|---|
| **Key Generation** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Must use platform secure RNG |
| **Forward Secrecy** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Signal-aligned ratchet |
| **Replay Protection** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Duplicate nonce/messageId rejection |
| **Ciphertext Integrity** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Tamper rejection (AEAD) |
| **Message Auth** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Signature verification |
| **Sender Keys** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Group optimization |

---

## 2. Storage Parity
| Capability | Required | Android | iOS | Web | Status | Notes |
|---|---|---|---|---|---|---|
| **Plaintext Storage** | FORBIDDEN | ✅ | ✅ | ✅ | ✅ Implemented | Strictly prohibited |
| **Encrypted Storage** | REQUIRED | ✅ | ✅ | ✅ | ⚠️ Partial | SQLCipher (Mobile) / Encrypted IDB (Web - Pending) |
| **Key Storage** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Keystore / Keychain / Encrypted IDB |

---

## 3. Device Trust Parity
| Capability | Required | Android | iOS | Web | Status | Notes |
|---|---|---|---|---|---|---|
| **Safety Number** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Visual fingerprint comparison |
| **Key Change Warn** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Blocking warning on identity change |
| **Device Revocation** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Immediate access cut-off |

---

## 4. Offline / Sync Parity
| Capability | Required | Android | iOS | Web | Status | Notes |
|---|---|---|---|---|---|---|
| **Offline Queue** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Retry-safe logic |
| **Repair Protocol** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Gap detection & filling |
| **Read Receipts** | REQUIRED | ✅ | ✅ | ✅ | ✅ Implemented | Sync convergence |

---

## 5. Security Invariants
See `security_invariants.md` for strict non-negotiable rules enforced by CI.
