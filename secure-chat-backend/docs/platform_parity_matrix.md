# ChatFlect Platform Parity Matrix
**Epic 46: Multi-Platform Security Contract**

This document defines the required security and behavioral parity across all ChatFlect platforms.
**Platforms**: Android, iOS, Web
**Rule**: No platform may ship with weaker security guarantees than another platform.

---

## 1. Crypto Parity
| Capability | Android | iOS | Web | Status | Notes |
|---|---|---|---|---|---|
| **Key Generation** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Must use platform secure RNG |
| **Forward Secrecy** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Signal-aligned ratchet |
| **Replay Protection** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Duplicate nonce/messageId rejection |
| **Ciphertext Integrity** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Tamper rejection (AEAD) |
| **Message Auth** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Signature verification |
| **Sender Keys** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Group optimization |

---

## 2. Storage Parity
| Capability | Android | iOS | Web | Status | Notes |
|---|---|---|---|---|---|
| **Plaintext Storage** | FORBIDDEN | FORBIDDEN | FORBIDDEN | ✅ Enforced | Strictly prohibited |
| **Encrypted Storage** | ENFORCED | ENFORCED | PENDING | ⚠️ Partial | SQLCipher (Mobile) / Encrypted IDB (Web - Pending) |
| **Key Storage** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Keystore / Keychain / Encrypted IDB |

---

## 3. Device Trust Parity
| Capability | Android | iOS | Web | Status | Notes |
|---|---|---|---|---|---|
| **Safety Number** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Visual fingerprint comparison |
| **Key Change Warn** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Blocking warning on identity change |
| **Device Revocation** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Immediate access cut-off |

---

## 4. Offline / Sync Parity
| Capability | Android | iOS | Web | Status | Notes |
|---|---|---|---|---|---|
| **Offline Queue** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Retry-safe logic |
| **Repair Protocol** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Gap detection & filling |
| **Read Receipts** | ENFORCED | ENFORCED | ENFORCED | ✅ Implemented | Sync convergence |

---

## 5. Security Invariants
See `security_invariants.md` for strict non-negotiable rules enforced by CI.

---

## 6. Known Gaps / Open Risks
- **Web Encrypted Storage**: Pending implementation of robust encrypted IndexedDB layer. Currently relies on basic browser storage protections which are insufficient for "At Rest" guarantees.
- **Auditing**: Need platform-specific audit for crash logs and analytics pipelines to ensure full compliance with Invariant #9 (No Key Material Logging).
