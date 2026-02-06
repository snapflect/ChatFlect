# Phase 2 P0 Security Blockers (TASK 1.5-A) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Classification**: Engineering Priority Order

---

## Executive Summary

This document consolidates all **CRITICAL** and **HIGH** severity vulnerabilities confirmed during Phase 1 validation into the official Phase 2 engineering priority order.

| Severity | Count | Sprint Target |
| :---: | :---: | :---: |
| 🔴 CRITICAL | 4 | Sprint 1 |
| 🟡 HIGH | 5 | Sprint 1-2 |
| 🟠 MEDIUM | 4 | Sprint 2-3 |

---

## P0 Critical Blockers (Sprint 1 Required)

### P0-001: Unauthenticated Device Registration (J4)

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | J4 |
| **Severity** | 🔴 CRITICAL (25) |
| **Exploit Type** | Unauthenticated API abuse |
| **Affected Endpoint** | `devices.php` |
| **Attack Scenario** | Attacker registers rogue device for any user, receives all E2EE messages |
| **Evidence** | [backend-auth-verification-report.md](../baseline/validation/backend-auth-verification-report.md) |
| **Fix Required** | Add `requireAuth()` + validate user_id matches session |
| **Dependencies** | None (standalone fix) |
| **Sprint Target** | Sprint 1 |
| **LOE** | 2 hours |

---

### P0-002: Unauthenticated File Upload (J6)

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | J6 |
| **Severity** | 🔴 CRITICAL (16) |
| **Exploit Type** | Unauthenticated API abuse |
| **Affected Endpoint** | `upload.php` |
| **Attack Scenario** | Attacker uploads unlimited files, storage exhaustion, cost attack |
| **Evidence** | [backend-auth-verification-report.md](../baseline/validation/backend-auth-verification-report.md) |
| **Fix Required** | Add `requireAuth()` + user quotas (10MB/file, 100MB/user) |
| **Dependencies** | None (standalone fix) |
| **Sprint Target** | Sprint 1 |
| **LOE** | 3 hours |

---

### P0-003: Plaintext Backup Exposure (H2)

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | H2 |
| **Severity** | 🔴 CRITICAL (20) |
| **Exploit Type** | Plaintext key exposure |
| **Affected Module** | `backup.service.ts` |
| **Attack Scenario** | Backup file stolen from cloud/email exposes master private key |
| **Evidence** | [crypto-runtime-validation-report.md](../baseline/validation/crypto-runtime-validation-report.md) |
| **Fix Required** | PBKDF2 key derivation + AES-256-GCM encryption of backup JSON |
| **Dependencies** | None (frontend-only) |
| **Sprint Target** | Sprint 1 |
| **LOE** | 4 hours |

---

### P0-004: Backend Key Injection (E1)

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | E1 |
| **Severity** | 🔴 CRITICAL (15) |
| **Exploit Type** | MITM via key replacement |
| **Affected Endpoint** | `keys.php` |
| **Attack Scenario** | Compromised backend replaces victim's public key, intercepts all messages |
| **Evidence** | [crypto-runtime-validation-report.md](../baseline/validation/crypto-runtime-validation-report.md) |
| **Fix Required** | Signed key bundles + Safety Numbers verification |
| **Dependencies** | P0-001 (auth required first) |
| **Sprint Target** | Sprint 2 |
| **LOE** | 16 hours |

---

## P1 High Priority Blockers (Sprint 1-2)

### P1-001: Status Identity Spoofing (J9)

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | J9 |
| **Severity** | 🟡 HIGH (15) |
| **Exploit Type** | User impersonation |
| **Affected Endpoint** | `status.php` |
| **Attack Scenario** | Attacker posts status updates as any user |
| **Fix Required** | Call `requireAuth()` + validate user_id matches session |
| **Dependencies** | None |
| **Sprint Target** | Sprint 1 |
| **LOE** | 2 hours |

---

### P1-002: XSS Token Theft (T1-S-02)

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | T1-S-02 |
| **Severity** | 🟡 HIGH (15) |
| **Exploit Type** | XSS + localStorage extraction |
| **Affected Module** | All services using localStorage |
| **Attack Scenario** | XSS payload extracts all tokens and private key |
| **Fix Required** | Migrate tokens to HTTP-Only cookies |
| **Dependencies** | Backend cookie support |
| **Sprint Target** | Sprint 2 |
| **LOE** | 8 hours |

---

### P1-003: Plaintext localStorage Keys (G1)

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | G1 |
| **Severity** | 🟡 HIGH (15) |
| **Exploit Type** | Local storage extraction |
| **Affected Module** | `auth.service.ts`, `backup.service.ts`, `chat.service.ts` |
| **Attack Scenario** | Device access or XSS exposes all keys |
| **Fix Required** | Use SecureStorage plugin on mobile, encrypt on web |
| **Dependencies** | Capacitor SecureStorage plugin |
| **Sprint Target** | Sprint 2 |
| **LOE** | 8 hours |

---

### P1-004: Keys.php Unauthenticated (E1 enabler)

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | E1 (enabler) |
| **Severity** | 🟡 HIGH (15) |
| **Exploit Type** | Information disclosure |
| **Affected Endpoint** | `keys.php` |
| **Attack Scenario** | Anyone can enumerate user public keys and device lists |
| **Fix Required** | Add `requireAuth()` for sensitive operations |
| **Dependencies** | None |
| **Sprint Target** | Sprint 1 |
| **LOE** | 2 hours |

---

### P1-005: Chat Metadata Leakage (I1/I2)

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | I1, I2 |
| **Severity** | 🟡 HIGH (15) |
| **Exploit Type** | Privacy leakage |
| **Affected Collection** | Firestore `/chats`, `/messages` |
| **Attack Scenario** | Server operator sees activity patterns, device counts |
| **Fix Required** | Encrypt metadata fields, pad keys map |
| **Dependencies** | None |
| **Sprint Target** | Sprint 3 |
| **LOE** | 8 hours |

---

## P2 Medium Priority (Sprint 2-3)

### P2-001: Missing Audit Logging

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | LOGS-001 |
| **Severity** | 🟠 MEDIUM |
| **Affected Module** | Backend API |
| **Fix Required** | Add logging to keys.php, upload.php, status.php |
| **Sprint Target** | Sprint 2 |
| **LOE** | 4 hours |

---

### P2-002: Missing Rate Limit Metrics

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | LOGS-002 |
| **Severity** | 🟠 MEDIUM |
| **Affected Module** | `rate_limiter.php` |
| **Fix Required** | Log rate limit exceeded events |
| **Sprint Target** | Sprint 2 |
| **LOE** | 2 hours |

---

### P2-003: Missing Correlation IDs

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | LOGS-003 |
| **Severity** | 🟠 MEDIUM |
| **Affected Module** | All API endpoints |
| **Fix Required** | Add X-Request-ID header propagation |
| **Sprint Target** | Sprint 3 |
| **LOE** | 4 hours |

---

### P2-004: Firestore Rules Validation

| Attribute | Value |
| :--- | :--- |
| **Risk ID** | T3-E-01 |
| **Severity** | 🟠 MEDIUM |
| **Affected Module** | Firestore security rules |
| **Fix Required** | Audit and harden cross-user access rules |
| **Sprint Target** | Sprint 2 |
| **LOE** | 4 hours |

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    SPRINT 1 (Week 1-2)                      │
├─────────────────────────────────────────────────────────────┤
│  P0-001 (devices.php)  ──┐                                  │
│  P0-002 (upload.php)   ──┼── Independent fixes              │
│  P1-001 (status.php)   ──┤                                  │
│  P1-004 (keys.php)     ──┘                                  │
│                                                             │
│  P0-003 (Encrypted Backup) ── Frontend only                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SPRINT 2 (Week 3-4)                      │
├─────────────────────────────────────────────────────────────┤
│  P0-004 (Signed Key Bundles) ◄── Requires P0-001, P1-004    │
│  P1-002 (HTTP-Only Cookies)  ── Backend + Frontend          │
│  P1-003 (SecureStorage)      ── Frontend + Mobile           │
│  P2-001 (Audit Logging)      ── Backend                     │
│  P2-004 (Firestore Rules)    ── Firebase                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SPRINT 3 (Week 5-6)                      │
├─────────────────────────────────────────────────────────────┤
│  P1-005 (Metadata Encryption) ── Frontend + Firestore       │
│  P2-003 (Correlation IDs)     ── Full stack                 │
│  Key Transparency Log         ── Long-term                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary Table

| ID | Blocker | Severity | Sprint | LOE | Owner |
| :--- | :--- | :---: | :---: | :---: | :--- |
| P0-001 | devices.php auth | CRITICAL | 1 | 2h | Backend |
| P0-002 | upload.php auth | CRITICAL | 1 | 3h | Backend |
| P0-003 | Encrypted backup | CRITICAL | 1 | 4h | Frontend |
| P0-004 | Signed key bundles | CRITICAL | 2 | 16h | Full Stack |
| P1-001 | status.php auth | HIGH | 1 | 2h | Backend |
| P1-002 | HTTP-Only cookies | HIGH | 2 | 8h | Full Stack |
| P1-003 | SecureStorage | HIGH | 2 | 8h | Frontend |
| P1-004 | keys.php auth | HIGH | 1 | 2h | Backend |
| P1-005 | Metadata encryption | HIGH | 3 | 8h | Frontend |
| P2-001 | Audit logging | MEDIUM | 2 | 4h | Backend |
| P2-002 | Rate limit metrics | MEDIUM | 2 | 2h | Backend |
| P2-003 | Correlation IDs | MEDIUM | 3 | 4h | Full Stack |
| P2-004 | Firestore rules | MEDIUM | 2 | 4h | Firebase |

**Total LOE**: ~67 hours (~2 engineering weeks)
