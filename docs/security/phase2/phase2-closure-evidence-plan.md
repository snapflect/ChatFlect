# Phase 2 Closure Evidence Plan (TASK 1.5-F) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Classification**: Validation Requirements

---

## Purpose

This document defines the **closure evidence** required to confirm each security vulnerability is properly fixed. No epic can be marked "Done" without satisfying these evidence requirements.

---

## Evidence Requirements by Epic

### P2-E01: Backend Auth Enforcement

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E01-1 | API Test | devices.php returns 401 without auth header | QA | `tests/security/api/devices-auth.log` |
| E01-2 | API Test | devices.php returns 403 when user_id != auth user | QA | `tests/security/api/devices-authz.log` |
| E01-3 | API Test | upload.php returns 401 without auth | QA | `tests/security/api/upload-auth.log` |
| E01-4 | API Test | status.php returns 401 without auth | QA | `tests/security/api/status-auth.log` |
| E01-5 | API Test | keys.php returns 401 for sensitive operations | QA | `tests/security/api/keys-auth.log` |
| E01-6 | Burp Replay | Replay unauthenticated request captured in Phase 1 | Security | `evidence/burp/P2-E01-replay.png` |
| E01-7 | Code Review | PR approved by Security Lead | Security Lead | GitHub PR link |

**Regression Test**: `npm run test:security:auth` must pass

---

### P2-E02: Encrypted Backup Export

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E02-1 | Unit Test | createBackup() produces encrypted blob | Developer | `tests/services/backup.spec.ts` |
| E02-2 | Unit Test | restoreBackup() with correct password succeeds | Developer | `tests/services/backup.spec.ts` |
| E02-3 | Unit Test | restoreBackup() with wrong password fails | Developer | `tests/services/backup.spec.ts` |
| E02-4 | Hex Dump | Export file contains no JSON structure | Security | `evidence/backup/export-hexdump.txt` |
| E02-5 | Manual Test | Full backup/restore cycle on real device | QA | `evidence/backup/restore-screenshot.png` |
| E02-6 | Code Review | Crypto implementation reviewed | Security Lead | GitHub PR link |

**Regression Test**: `npm run test:security:crypto` must pass

---

### P2-E03: Signed Key Bundles

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E03-1 | Unit Test | signPublicKey() generates valid signature | Developer | `tests/services/crypto.spec.ts` |
| E03-2 | Unit Test | verifyKeySignature() passes for valid sig | Developer | `tests/services/crypto.spec.ts` |
| E03-3 | Unit Test | verifyKeySignature() fails for tampered key | Developer | `tests/services/crypto.spec.ts` |
| E03-4 | DB Injection | Modify key in DB → client shows warning | Security | `evidence/keys/injection-warning.png` |
| E03-5 | API Test | keys.php returns signature with public key | QA | `tests/security/api/keys-signature.log` |
| E03-6 | E2E Test | Full message flow with signed keys works | QA | `evidence/keys/e2e-signed.log` |
| E03-7 | Code Review | Ed25519 implementation reviewed | Security Lead | GitHub PR link |

**Regression Test**: `npm run test:security:keys` must pass

---

### P2-E04: Token Storage Hardening

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E04-1 | Browser Test | `localStorage.getItem('access_token')` returns null | QA | `evidence/tokens/localstorage-null.png` |
| E04-2 | Network Test | Response contains `Set-Cookie: HttpOnly; Secure` | QA | `evidence/tokens/set-cookie.png` |
| E04-3 | XSS Simulation | XSS payload cannot extract tokens | Security | `evidence/tokens/xss-simulation.log` |
| E04-4 | CSRF Test | Request without CSRF token fails | QA | `tests/security/api/csrf-fail.log` |
| E04-5 | CSRF Test | Request with correct CSRF token succeeds | QA | `tests/security/api/csrf-pass.log` |
| E04-6 | E2E Test | Full auth flow works with cookies | QA | `evidence/tokens/e2e-cookie-auth.log` |
| E04-7 | Mobile Test | Mobile auth still works after migration | QA | `evidence/tokens/mobile-auth.log` |

**Regression Test**: `npm run test:security:tokens` must pass

---

### P2-E05: Mobile SecureStorage

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E05-1 | iOS Test | private_key in iOS Keychain | QA | `evidence/mobile/ios-keychain.png` |
| E05-2 | Android Test | private_key in Android Keystore | QA | `evidence/mobile/android-keystore.png` |
| E05-3 | File System | No plaintext keys in app sandbox | Security | `evidence/mobile/fs-inspection.log` |
| E05-4 | Migration Test | Keys migrate from localStorage on update | QA | `evidence/mobile/migration.log` |
| E05-5 | Fallback Test | Web platform uses encrypted fallback | QA | `tests/services/secure-storage.spec.ts` |

**Regression Test**: `npm run test:security:storage` must pass

---

### P2-E06: Firestore Rule Hardening

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E06-1 | Emulator Test | Cross-user message read denied | QA | `evidence/firestore/cross-read.log` |
| E06-2 | Emulator Test | Cross-user message write denied | QA | `evidence/firestore/cross-write.log` |
| E06-3 | Emulator Test | sync_requests read by non-owner denied | QA | `evidence/firestore/sync-denied.log` |
| E06-4 | Coverage Report | All collections have explicit rules | QA | `evidence/firestore/coverage.html` |
| E06-5 | Production Test | Confirm rules deployed to production | Firebase Admin | `evidence/firestore/deploy.log` |

**Regression Test**: `npm run test:firestore:rules` must pass

---

### P2-E07: Audit Logging Enhancement

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E07-1 | Log Review | keys.php logs key_fetch events | QA | `evidence/logs/keys-audit.log` |
| E07-2 | Log Review | upload.php logs upload events | QA | `evidence/logs/upload-audit.log` |
| E07-3 | Log Review | Failed auth attempts logged | QA | `evidence/logs/auth-failed.log` |
| E07-4 | Log Format | Logs contain user_id, ip, timestamp, event_type | QA | `evidence/logs/format-check.log` |
| E07-5 | Log Query | Audit logs searchable by user_id | QA | `evidence/logs/query-test.log` |

**Regression Test**: Manual log review after test execution

---

### P2-E08: Rate Limiting & Metrics

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E08-1 | Load Test | Trigger rate limit → event logged | QA | `evidence/ratelimit/exceeded.log` |
| E08-2 | Metrics Check | Rate limit breach count visible | QA | `evidence/ratelimit/metrics.png` |
| E08-3 | Endpoint Test | Different endpoints have different limits | QA | `evidence/ratelimit/endpoints.log` |

**Regression Test**: `npm run test:security:ratelimit` must pass

---

### P2-E09: Metadata Privacy

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E09-1 | Firestore Inspection | lastMessage field encrypted or removed | Security | `evidence/privacy/lastmsg.png` |
| E09-2 | Firestore Inspection | keys map padded to fixed size | Security | `evidence/privacy/keysmap.png` |
| E09-3 | E2E Test | Chat still works with metadata changes | QA | `evidence/privacy/e2e-chat.log` |

**Regression Test**: `npm run test:privacy:metadata` must pass

---

### P2-E10: Observability & Correlation

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E10-1 | API Trace | Request and response have same X-Request-ID | QA | `evidence/correlation/trace.log` |
| E10-2 | Log Trace | Backend logs include correlation ID | QA | `evidence/correlation/backend.log` |
| E10-3 | Error Trace | Error reports include correlation ID | QA | `evidence/correlation/error.log` |

**Regression Test**: `npm run test:observability` must pass

---

### P2-E11: Safety Numbers UI

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E11-1 | UI Test | Safety number displayed in contact info | QA | `evidence/safetynumbers/display.png` |
| E11-2 | Comparison Test | Numbers match on both devices | QA | `evidence/safetynumbers/match.png` |
| E11-3 | QR Test | QR scan verification works | QA | `evidence/safetynumbers/qr-scan.mp4` |
| E11-4 | Badge Test | "Verified" badge shown after confirmation | QA | `evidence/safetynumbers/badge.png` |

**Regression Test**: `npm run test:safetynumbers` must pass

---

### P2-E12: Security Regression Tests

| Evidence # | Test Type | Description | Who Runs | Proof Location |
| :---: | :--- | :--- | :--- | :--- |
| E12-1 | CI Pipeline | Security tests run on every PR | DevOps | GitHub Actions log |
| E12-2 | Coverage Report | All P0/P1 fixes have test coverage | QA | `coverage/security-tests.html` |
| E12-3 | Block Test | Failed security test blocks merge | DevOps | GitHub Actions failure log |
| E12-4 | Test Suite | Full security test suite passes | QA | `tests/security/full-suite.log` |

**Regression Test**: CI/CD pipeline green

---

## Security Regression Plan

### Pre-Merge Checks
1. All security unit tests pass
2. Linting with security rules pass
3. Dependency vulnerability scan clean

### Post-Merge Checks
1. Integration security tests pass
2. No new security warnings in logs
3. No performance regression in auth flow

### Weekly Checks
1. Review audit logs for anomalies
2. Check rate limit breach metrics
3. Review error correlation patterns

### Monthly Checks
1. Run penetration test (manual)
2. Review security test coverage
3. Update threat model if needed

---

## Evidence Storage Structure

```
docs/security/phase2/evidence/
├── burp/
│   └── P2-E01-replay.png
├── backup/
│   ├── export-hexdump.txt
│   └── restore-screenshot.png
├── keys/
│   ├── injection-warning.png
│   └── e2e-signed.log
├── tokens/
│   ├── localstorage-null.png
│   ├── set-cookie.png
│   └── xss-simulation.log
├── mobile/
│   ├── ios-keychain.png
│   ├── android-keystore.png
│   └── fs-inspection.log
├── firestore/
│   ├── cross-read.log
│   ├── cross-write.log
│   └── coverage.html
├── logs/
│   ├── keys-audit.log
│   └── auth-failed.log
├── ratelimit/
│   └── exceeded.log
├── privacy/
│   ├── lastmsg.png
│   └── keysmap.png
├── correlation/
│   └── trace.log
└── safetynumbers/
    ├── display.png
    ├── match.png
    └── qr-scan.mp4
```
