# Phase 2 Threat-to-Mitigation Traceability Matrix (TASK 1.5-C) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Classification**: Enterprise Audit Grade

---

## Purpose

This matrix provides end-to-end traceability from identified threats to:
- Root cause
- Mitigation epic
- Code changes required
- Test cases for closure
- Evidence artifacts

This is mandatory for enterprise security audits and SOC 2 compliance.

---

## Traceability Matrix

### CRITICAL Severity Threats

| Threat ID | STRIDE | Threat Description | Root Cause | Fix Epic | Code Modules | Test Case ID | Evidence Artifact |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- |
| **J4** | S | Unauthenticated Device Registration | Missing `requireAuth()` in devices.php | P2-E01 | `devices.php` | TC-H-01 | Burp replay log |
| **J6** | E | Unauthenticated File Upload | Missing auth in upload.php | P2-E01 | `upload.php` | TC-H-03 | Burp replay log |
| **H2** | I | Plaintext Backup Exposure | No encryption in backup.service.ts | P2-E02 | `backup.service.ts` | TC-J-02 | Hex dump, unit test |
| **E1** | S/R | Backend Key Injection | No key signatures, unauthenticated keys.php | P2-E03, P2-E01 | `keys.php`, `crypto.service.ts` | TC-J-01 | Signature verification log |

---

### HIGH Severity Threats

| Threat ID | STRIDE | Threat Description | Root Cause | Fix Epic | Code Modules | Test Case ID | Evidence Artifact |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- |
| **J9** | S | Status Identity Spoofing | Missing auth enforcement in status.php | P2-E01 | `status.php` | TC-H-04 | Burp replay log |
| **T1-S-02** | I | XSS Token Theft | Tokens in localStorage | P2-E04 | `auth.service.ts`, backend | TC-G-01 | XSS simulation log |
| **G1** | I | Plaintext localStorage Keys | No encryption of stored keys | P2-E05 | `secure-storage.service.ts` | TC-G-02 | Device inspection |
| **I1** | I | Chat Metadata Leakage | Plaintext lastMessage field | P2-E09 | `chat.service.ts`, Firestore | TC-I-01 | Firestore inspection |
| **I2** | I | Device Count Exposure | Unpadded keys map in messages | P2-E09 | `chat.service.ts` | TC-I-02 | Message inspection |
| **LOGS-001** | R | Missing Audit Logging | Incomplete auditLog() coverage | P2-E07 | All PHP endpoints | TC-K-01 | Log review |

---

### MEDIUM Severity Threats

| Threat ID | STRIDE | Threat Description | Root Cause | Fix Epic | Code Modules | Test Case ID | Evidence Artifact |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- |
| **LOGS-002** | D | Missing Rate Limit Metrics | No logging of rate limit breaches | P2-E08 | `rate_limiter.php` | TC-K-02 | Metrics log |
| **LOGS-003** | R | Missing Correlation IDs | No X-Request-ID propagation | P2-E10 | All modules | TC-K-03 | Request trace |
| **T3-E-01** | E | Firestore Rule Weakness | Insufficient cross-user protection | P2-E06 | `firestore.rules` | TC-I-01 | Firebase Emulator log |

---

## Detailed Traceability Records

### J4: Unauthenticated Device Registration

```
┌─────────────────────────────────────────────────────────────────────┐
│ THREAT: J4 - Unauthenticated Device Registration                    │
├─────────────────────────────────────────────────────────────────────┤
│ STRIDE Category    : Spoofing                                       │
│ Severity           : CRITICAL (25)                                  │
│ Root Cause         : devices.php has no requireAuth() call          │
│                                                                     │
│ FIX EPIC           : P2-E01 (Backend Auth Enforcement)              │
│ FIX STORIES        : P2-S1.1, P2-S1.4                               │
│                                                                     │
│ CODE CHANGES:                                                       │
│ ├── devices.php                                                     │
│ │   ├── Add: require_once 'auth_middleware.php'                     │
│ │   ├── Add: $authUserId = requireAuth()                            │
│ │   └── Add: Validate user_id === $authUserId                       │
│                                                                     │
│ TEST CASES:                                                         │
│ ├── TC-H-01: Unauthenticated device registration attempt            │
│ ├── TC-H-02: Registration with wrong user_id                        │
│                                                                     │
│ CLOSURE EVIDENCE:                                                   │
│ ├── Burp Suite replay showing 401 response                          │
│ ├── Unit test results                                               │
│ └── Code review approval                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### H2: Plaintext Backup Exposure

```
┌─────────────────────────────────────────────────────────────────────┐
│ THREAT: H2 - Plaintext Backup Exposure                              │
├─────────────────────────────────────────────────────────────────────┤
│ STRIDE Category    : Information Disclosure                         │
│ Severity           : CRITICAL (20)                                  │
│ Root Cause         : backup.service.ts exports JSON without encrypt │
│                                                                     │
│ FIX EPIC           : P2-E02 (Encrypted Backup Export)               │
│ FIX STORIES        : P2-S2.1, P2-S2.2                               │
│                                                                     │
│ CODE CHANGES:                                                       │
│ ├── backup.service.ts                                               │
│ │   ├── Add: PBKDF2 key derivation from password                    │
│ │   ├── Add: AES-256-GCM encryption of JSON                         │
│ │   ├── Mod: createBackup(password) signature                       │
│ │   └── Mod: restoreBackup(blob, password) signature                │
│                                                                     │
│ TEST CASES:                                                         │
│ ├── TC-J-02: Backup export produces encrypted blob                  │
│ ├── TC-J-03: Restore with correct password succeeds                 │
│ ├── TC-J-04: Restore with wrong password fails                      │
│                                                                     │
│ CLOSURE EVIDENCE:                                                   │
│ ├── Hex dump of export file (no JSON structure)                     │
│ ├── Unit test results for encrypt/decrypt cycle                     │
│ └── Manual verification of restore flow                             │
└─────────────────────────────────────────────────────────────────────┘
```

### E1: Backend Key Injection

```
┌─────────────────────────────────────────────────────────────────────┐
│ THREAT: E1 - Backend Key Injection                                  │
├─────────────────────────────────────────────────────────────────────┤
│ STRIDE Category    : Spoofing / Repudiation                         │
│ Severity           : CRITICAL (15)                                  │
│ Root Cause         : No key signatures, keys.php unauthenticated    │
│                                                                     │
│ FIX EPICS          : P2-E01 (Auth), P2-E03 (Signed Keys)            │
│ FIX STORIES        : P2-S1.3, P2-S3.1, P2-S3.2                      │
│                                                                     │
│ CODE CHANGES:                                                       │
│ ├── keys.php                                                        │
│ │   └── Add: requireAuth() for fetch operations                     │
│ ├── devices.php                                                     │
│ │   └── Add: Store key_signature on registration                    │
│ ├── crypto.service.ts                                               │
│ │   ├── Add: signPublicKey() method                                 │
│ │   └── Add: verifyKeySignature() method                            │
│ ├── chat.service.ts                                                 │
│ │   └── Mod: Verify signature before encrypting to key              │
│                                                                     │
│ TEST CASES:                                                         │
│ ├── TC-J-01: Tampered key detected and warning shown                │
│ ├── TC-H-05: keys.php returns 401 without auth                      │
│                                                                     │
│ CLOSURE EVIDENCE:                                                   │
│ ├── DB injection test + client warning screenshot                   │
│ ├── API test showing signature in response                          │
│ └── Unit test for signature verification                            │
└─────────────────────────────────────────────────────────────────────┘
```

### T1-S-02: XSS Token Theft

```
┌─────────────────────────────────────────────────────────────────────┐
│ THREAT: T1-S-02 - XSS Token Theft                                   │
├─────────────────────────────────────────────────────────────────────┤
│ STRIDE Category    : Information Disclosure                         │
│ Severity           : HIGH (15)                                      │
│ Root Cause         : Tokens stored in accessible localStorage       │
│                                                                     │
│ FIX EPIC           : P2-E04 (Token Storage Hardening)               │
│ FIX STORIES        : P2-S4.1, P2-S4.2, P2-S4.3                      │
│                                                                     │
│ CODE CHANGES:                                                       │
│ ├── firebase_auth.php                                               │
│ │   └── Mod: Set-Cookie with HttpOnly, Secure, SameSite             │
│ ├── auth_middleware.php                                             │
│ │   └── Mod: Read token from cookie instead of header               │
│ ├── auth.service.ts                                                 │
│ │   ├── Del: localStorage.setItem('access_token')                   │
│ │   └── Add: CSRF token handling                                    │
│ ├── api.service.ts                                                  │
│ │   └── Mod: withCredentials: true for cookie sending               │
│                                                                     │
│ TEST CASES:                                                         │
│ ├── TC-G-01: XSS simulation cannot extract tokens                   │
│ ├── TC-G-03: API calls work with cookie auth                        │
│                                                                     │
│ CLOSURE EVIDENCE:                                                   │
│ ├── Console showing localStorage.getItem('access_token') === null   │
│ ├── Network tab showing Set-Cookie headers                          │
│ └── XSS simulation script failure log                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Summary Statistics

| Severity | Threats | Epics Required | Stories | Test Cases |
| :---: | :---: | :---: | :---: | :---: |
| CRITICAL | 4 | 3 | 8 | 8 |
| HIGH | 6 | 6 | 12 | 10 |
| MEDIUM | 3 | 3 | 6 | 4 |
| **TOTAL** | **13** | **12** | **26** | **22** |

---

## Cross-Reference Index

### By Epic

| Epic ID | Threats Resolved |
| :---: | :--- |
| P2-E01 | J4, J6, J9, E1 (partial) |
| P2-E02 | H2 |
| P2-E03 | E1 |
| P2-E04 | T1-S-02 |
| P2-E05 | G1 |
| P2-E06 | T3-E-01, I1, I2 (partial) |
| P2-E07 | LOGS-001 |
| P2-E08 | LOGS-002 |
| P2-E09 | I1, I2 |
| P2-E10 | LOGS-003 |

### By Test Case

| Test Case | Validates Closure Of |
| :---: | :--- |
| TC-H-01 | J4 |
| TC-H-02 | J4 |
| TC-H-03 | J6 |
| TC-H-04 | J9 |
| TC-H-05 | E1 (partial) |
| TC-J-01 | E1 |
| TC-J-02 | H2 |
| TC-J-03 | H2 |
| TC-J-04 | H2 |
| TC-G-01 | T1-S-02 |
| TC-G-02 | G1 |
| TC-G-03 | T1-S-02 |
| TC-I-01 | I1, T3-E-01 |
| TC-I-02 | I2 |
| TC-K-01 | LOGS-001 |
| TC-K-02 | LOGS-002 |
| TC-K-03 | LOGS-003 |
