# Phase 2 Security Epics (TASK 1.5-B) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Classification**: Phase 2 Implementation Scope

---

## Epic Overview

| Epic ID | Epic Name | Risk IDs | Sprint | Priority |
| :---: | :--- | :--- | :---: | :---: |
| P2-E01 | Backend Auth Enforcement | J4, J6, J9 | 1 | P0 |
| P2-E02 | Encrypted Backup Export | H2 | 1 | P0 |
| P2-E03 | Signed Key Bundles | E1 | 2 | P0 |
| P2-E04 | Token Storage Hardening | T1-S-02, G1 | 2 | P1 |
| P2-E05 | Mobile SecureStorage | G1 | 2 | P1 |
| P2-E06 | Firestore Rule Hardening | I1, I2, T3-E-01 | 2 | P1 |
| P2-E07 | Audit Logging Enhancement | LOGS-001 | 2 | P2 |
| P2-E08 | Rate Limiting & Metrics | LOGS-002 | 2 | P2 |
| P2-E09 | Metadata Privacy | I1, I2 | 3 | P2 |
| P2-E10 | Observability & Correlation | LOGS-003 | 3 | P2 |
| P2-E11 | Safety Numbers UI | E1 | 3 | P1 |
| P2-E12 | Security Regression Tests | All | 3-4 | P1 |

---

## P2-E01: Backend Auth Enforcement

### Epic Summary
Add authentication middleware enforcement to all vulnerable PHP endpoints identified in Phase 1 validation.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Prevent unauthenticated API access to sensitive endpoints |
| **Risk IDs Resolved** | J4, J6, J9 |
| **Affected Modules** | `devices.php`, `upload.php`, `status.php`, `keys.php` |
| **Change Type** | API Security (Backend) |
| **Sprint** | Sprint 1 |
| **LOE** | 9 hours |

### Technical Scope
- Add `require_once 'auth_middleware.php'` to all endpoints
- Add `$authUserId = requireAuth()` at entry point
- Validate request `user_id` matches `$authUserId`
- Return 401/403 for unauthorized requests

### Non-Goals
- Changing authentication mechanism itself
- Modifying JWT format or expiry

### Definition of Done
- [ ] All 4 endpoints protected with `requireAuth()`
- [ ] Unit tests for 401/403 responses
- [ ] Burp Suite replay test confirms protection
- [ ] Code review by Security Lead

### Closure Validation
1. Burp Suite test: replay unauthenticated request → 401
2. Postman test: invalid token → 401
3. API test: wrong user_id → 403

---

## P2-E02: Encrypted Backup Export

### Epic Summary
Replace plaintext JSON backup export with password-encrypted format using PBKDF2 key derivation and AES-256-GCM.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Protect master private key in backup files |
| **Risk IDs Resolved** | H2 |
| **Affected Modules** | `backup.service.ts` |
| **Change Type** | Crypto Change (Frontend) |
| **Sprint** | Sprint 1 |
| **LOE** | 4 hours |

### Technical Scope
- Derive encryption key from user password (PBKDF2, 100K iterations)
- Encrypt backup JSON with AES-256-GCM
- Store salt + IV + ciphertext in export file
- Update restore to decrypt with password

### Non-Goals
- Cloud backup sync
- Automatic backup scheduling

### Definition of Done
- [ ] Export produces encrypted blob, not plaintext JSON
- [ ] Restore prompts for password
- [ ] Wrong password fails gracefully
- [ ] Unit tests for encrypt/decrypt cycle

### Closure Validation
1. Export file inspection shows no plaintext `private_key`
2. Hex dump shows random bytes (not JSON structure)
3. Restore with correct password succeeds
4. Restore with wrong password fails with error

---

## P2-E03: Signed Key Bundles

### Epic Summary
Implement cryptographic signing of public key bundles to detect backend key injection attacks.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Enable clients to verify key authenticity |
| **Risk IDs Resolved** | E1 |
| **Affected Modules** | `keys.php`, `devices.php`, `chat.service.ts`, `crypto.service.ts` |
| **Change Type** | Crypto Change (Full Stack) |
| **Sprint** | Sprint 2 |
| **LOE** | 16 hours |

### Technical Scope
- Device signs its public key with identity key on registration
- Backend stores and returns signature with key
- Client verifies signature before encrypting to key
- Alert user if signature invalid

### Non-Goals
- Key transparency log (future)
- Automatic key rotation

### Definition of Done
- [ ] Device registration includes key signature
- [ ] Backend stores `key_signature` column
- [ ] Client verifies signature on key fetch
- [ ] Invalid signature shows security warning

### Closure Validation
1. Modify key in DB → client rejects with warning
2. Valid key → encryption proceeds normally
3. API returns signature with public key

---

## P2-E04: Token Storage Hardening

### Epic Summary
Migrate authentication tokens from localStorage to HTTP-Only cookies to prevent XSS theft.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Eliminate XSS-accessible token storage |
| **Risk IDs Resolved** | T1-S-02 |
| **Affected Modules** | `auth.service.ts`, `firebase_auth.php`, `auth_middleware.php` |
| **Change Type** | Auth Change (Full Stack) |
| **Sprint** | Sprint 2 |
| **LOE** | 8 hours |

### Technical Scope
- Backend sets tokens via `Set-Cookie: HttpOnly; Secure; SameSite=Strict`
- Frontend removes `localStorage.setItem('access_token')`
- Add CSRF token protection
- Update API interceptor to send cookies

### Non-Goals
- Changing token format
- Changing authentication flow

### Definition of Done
- [ ] Tokens no longer in localStorage
- [ ] Cookies marked HttpOnly + Secure
- [ ] CSRF token implemented
- [ ] XSS simulation cannot extract tokens

### Closure Validation
1. Console `localStorage.getItem('access_token')` → null
2. Network tab shows `Set-Cookie` headers
3. XSS payload cannot access tokens

---

## P2-E05: Mobile SecureStorage

### Epic Summary
Migrate private keys and sensitive data to native secure storage on iOS (Keychain) and Android (Keystore).

| Attribute | Value |
| :--- | :--- |
| **Objective** | Protect keys from device compromise |
| **Risk IDs Resolved** | G1 |
| **Affected Modules** | `secure-storage.service.ts`, `auth.service.ts` |
| **Change Type** | Mobile Security |
| **Sprint** | Sprint 2 |
| **LOE** | 8 hours |

### Technical Scope
- Use Capacitor SecureStorage plugin for iOS/Android
- Store `private_key`, `public_key` in native keychain
- Fallback to encrypted localStorage on web
- Add biometric lock option (future)

### Non-Goals
- Hardware security modules
- Biometric authentication (Phase 3)

### Definition of Done
- [ ] Keys stored in native keychain on mobile
- [ ] Migration from localStorage on app update
- [ ] Fallback for web platform
- [ ] Device file system shows no plaintext keys

### Closure Validation
1. iOS: Keychain Access shows encrypted entries
2. Android: KeyStore contains app keys
3. File system inspection shows no plaintext

---

## P2-E06: Firestore Rule Hardening

### Epic Summary
Audit and harden Firestore security rules to prevent cross-user data access.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Enforce strict access control on Firestore collections |
| **Risk IDs Resolved** | I1, I2, T3-E-01 |
| **Affected Modules** | `firestore.rules` |
| **Change Type** | Firebase Security |
| **Sprint** | Sprint 2 |
| **LOE** | 4 hours |

### Technical Scope
- Audit all collection rules
- Enforce participant-only read on messages
- Enforce owner-only read on sync_requests
- Add rate limiting rules if supported

### Non-Goals
- Schema migration
- Collection restructuring

### Definition of Done
- [ ] All collections have explicit allow/deny rules
- [ ] Cross-user read test fails
- [ ] Cross-user write test fails
- [ ] Rules deployed to production

### Closure Validation
1. Firebase Emulator tests pass
2. Production rule test confirms denial
3. Security rule coverage report generated

---

## P2-E07: Audit Logging Enhancement

### Epic Summary
Add comprehensive audit logging to all API endpoints for security monitoring.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Enable forensic analysis and threat detection |
| **Risk IDs Resolved** | LOGS-001 |
| **Affected Modules** | All PHP endpoints |
| **Change Type** | Backend Logging |
| **Sprint** | Sprint 2 |
| **LOE** | 4 hours |

### Technical Scope
- Add audit logging to `keys.php`, `upload.php`, `status.php`, `profile.php`
- Log: event_type, user_id, ip, timestamp, action_details
- Add failed auth attempt logging
- Add rate limit exceeded logging

### Non-Goals
- Real-time alerting (Phase 3)
- SIEM integration (Phase 3)

### Definition of Done
- [ ] All endpoints log security-relevant events
- [ ] Logs include IP, user_id, action type
- [ ] Log format is consistent
- [ ] Log rotation configured

### Closure Validation
1. Review logs after test requests
2. Confirm IP and user_id present
3. Confirm failed requests logged

---

## P2-E08: Rate Limiting & Metrics

### Epic Summary
Enhance rate limiting with metrics collection and alerting hooks.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Detect and prevent abuse attacks |
| **Risk IDs Resolved** | LOGS-002 |
| **Affected Modules** | `rate_limiter.php` |
| **Change Type** | Backend Security |
| **Sprint** | Sprint 2 |
| **LOE** | 2 hours |

### Technical Scope
- Log rate limit exceeded events
- Add per-endpoint rate configuration
- Add IP-based and user-based limits
- Expose metrics endpoint (internal)

### Non-Goals
- Dynamic rate adjustment
- ML-based detection

### Definition of Done
- [ ] Rate limit events logged
- [ ] Metrics show limit breaches
- [ ] Different limits per endpoint

### Closure Validation
1. Trigger rate limit → event logged
2. Metrics endpoint shows breach count
3. Different endpoints have different limits

---

## P2-E09: Metadata Privacy

### Epic Summary
Encrypt or obfuscate sensitive metadata in Firestore to prevent server-side analysis.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Reduce privacy leakage from chat metadata |
| **Risk IDs Resolved** | I1, I2 |
| **Affected Modules** | `chat.service.ts`, Firestore schema |
| **Change Type** | Privacy Enhancement |
| **Sprint** | Sprint 3 |
| **LOE** | 8 hours |

### Technical Scope
- Encrypt `lastMessage` field in chat documents
- Pad `keys` map to fixed size (hide device count)
- Remove or encrypt `typing` indicators
- Evaluate encrypted unread counts

### Non-Goals
- Full E2EE on metadata (complex)
- Changing message structure

### Definition of Done
- [ ] `lastMessage` encrypted or removed
- [ ] `keys` map padded to fixed size
- [ ] Server cannot see message preview

### Closure Validation
1. Firestore inspection shows encrypted fields
2. Keys map shows fixed-size padding
3. Server logs show no plaintext metadata

---

## P2-E10: Observability & Correlation

### Epic Summary
Implement distributed tracing with correlation IDs across client, backend, and Firebase.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Enable end-to-end request tracing |
| **Risk IDs Resolved** | LOGS-003 |
| **Affected Modules** | All (full stack) |
| **Change Type** | Observability |
| **Sprint** | Sprint 3 |
| **LOE** | 4 hours |

### Technical Scope
- Generate `X-Request-ID` on client
- Pass through all API requests
- Log with correlation ID on backend
- Include in error reports

### Non-Goals
- OpenTelemetry integration (Phase 3)
- APM tooling

### Definition of Done
- [ ] All requests have correlation ID
- [ ] Backend logs include correlation ID
- [ ] Error reports include correlation ID

### Closure Validation
1. Request → response shows same X-Request-ID
2. Backend logs show correlation
3. Error includes trace ID

---

## P2-E11: Safety Numbers UI

### Epic Summary
Implement Safety Numbers feature for out-of-band key verification.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Allow users to verify end-to-end encryption keys |
| **Risk IDs Resolved** | E1 |
| **Affected Modules** | UI components, `chat.service.ts` |
| **Change Type** | UI Feature |
| **Sprint** | Sprint 3 |
| **LOE** | 8 hours |

### Technical Scope
- Generate safety number from public keys
- Display in contact info screen
- Allow QR code scanning for verification
- Show "Verified" badge after confirmation

### Non-Goals
- Automatic key verification
- Key pinning

### Definition of Done
- [ ] Safety number displayed for each contact
- [ ] QR code generation/scanning works
- [ ] "Verified" badge shown after confirmation

### Closure Validation
1. Safety number matches on both devices
2. QR scan verifies correctly
3. Badge displayed after verification

---

## P2-E12: Security Regression Tests

### Epic Summary
Create automated security regression test suite to prevent re-introduction of vulnerabilities.

| Attribute | Value |
| :--- | :--- |
| **Objective** | Ensure security fixes are not regressed |
| **Risk IDs Resolved** | All |
| **Affected Modules** | Test infrastructure |
| **Change Type** | Testing |
| **Sprint** | Sprint 3-4 |
| **LOE** | 12 hours |

### Technical Scope
- Create API security tests (auth enforcement)
- Create crypto tests (backup encryption)
- Create Firestore rule tests
- Integrate into CI/CD pipeline

### Non-Goals
- Penetration testing
- Fuzzing

### Definition of Done
- [ ] Auth enforcement tests pass
- [ ] Backup encryption tests pass
- [ ] Firestore rule tests pass
- [ ] Tests run on every PR

### Closure Validation
1. CI pipeline runs security tests
2. Coverage includes all P0/P1 fixes
3. Failed test blocks merge
