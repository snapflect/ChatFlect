# Phase 2 Jira WBS Export (TASK 1.5-G) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Classification**: Project Management

---

## WBS Structure

```
Phase 2 Security Hardening
├── P2-E01: Backend Auth Enforcement
│   ├── P2-S1.1: Protect devices.php
│   ├── P2-S1.2: Protect upload.php
│   ├── P2-S1.3: Protect keys.php
│   └── P2-S1.4: Protect status.php
├── P2-E02: Encrypted Backup Export
│   ├── P2-S2.1: Implement PBKDF2 encryption
│   └── P2-S2.2: Update restore flow
├── P2-E03: Signed Key Bundles
│   ├── P2-S3.1: Implement key signing
│   ├── P2-S3.2: Backend signature storage
│   └── P2-S3.3: Client signature verification
├── ... (continued)
```

---

## Epic: P2-E01 — Backend Auth Enforcement

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E01 |
| **Epic Name** | Backend Auth Enforcement |
| **Risk IDs** | J4, J6, J9 |
| **Sprint** | Sprint 1 |
| **Priority** | P0 (Blocker) |
| **Owner** | Backend Lead |
| **LOE** | 9 hours |

### Story: P2-S1.1 — Protect devices.php with Authentication

| Field | Value |
| :--- | :--- |
| **Story ID** | P2-S1.1 |
| **Story Name** | Protect devices.php with Authentication |
| **Epic** | P2-E01 |
| **Risk ID** | J4 |
| **Priority** | P0 |
| **Points** | 2 |
| **Assignee** | Backend Developer |

**Objective**: Add authentication enforcement to devices.php to prevent unauthenticated device registration.

**Acceptance Criteria**:
- [ ] `require_once 'auth_middleware.php'` added
- [ ] `$authUserId = requireAuth()` called at entry
- [ ] Request without auth returns 401
- [ ] Request with wrong user_id returns 403
- [ ] Unit tests pass
- [ ] Burp replay test passes

**Dependencies**: None

#### Task: P2-T1.1-A — Add auth_middleware import

| Field | Value |
| :--- | :--- |
| **Task ID** | P2-T1.1-A |
| **Story** | P2-S1.1 |
| **Description** | Add `require_once 'auth_middleware.php'` to devices.php |
| **LOE** | 15 min |

#### Task: P2-T1.1-B — Add requireAuth() call

| Field | Value |
| :--- | :--- |
| **Task ID** | P2-T1.1-B |
| **Story** | P2-S1.1 |
| **Description** | Add `$authUserId = requireAuth()` at file start |
| **LOE** | 15 min |

#### Task: P2-T1.1-C — Validate user_id matches auth user

| Field | Value |
| :--- | :--- |
| **Task ID** | P2-T1.1-C |
| **Story** | P2-S1.1 |
| **Description** | Compare request `user_id` with `$authUserId`, return 403 if mismatch |
| **LOE** | 30 min |

#### Task: P2-T1.1-D — Write unit tests

| Field | Value |
| :--- | :--- |
| **Task ID** | P2-T1.1-D |
| **Story** | P2-S1.1 |
| **Description** | Create PHPUnit tests for 401 and 403 responses |
| **LOE** | 1 hour |

---

### Story: P2-S1.2 — Protect upload.php with Authentication

| Field | Value |
| :--- | :--- |
| **Story ID** | P2-S1.2 |
| **Story Name** | Protect upload.php with Authentication |
| **Epic** | P2-E01 |
| **Risk ID** | J6 |
| **Priority** | P0 |
| **Points** | 3 |
| **Assignee** | Backend Developer |

**Objective**: Add authentication and user quotas to upload.php.

**Acceptance Criteria**:
- [ ] Auth enforcement added
- [ ] Per-user upload quota (100MB) enforced
- [ ] Per-file size limit (10MB) enforced
- [ ] Request without auth returns 401
- [ ] Quota exceeded returns 429

**Dependencies**: None

#### Task: P2-T1.2-A — Add auth middleware

| LOE | 15 min |

#### Task: P2-T1.2-B — Implement user quota tracking

| LOE | 1 hour |

#### Task: P2-T1.2-C — Add file size validation

| LOE | 30 min |

#### Task: P2-T1.2-D — Write unit tests

| LOE | 1 hour |

---

### Story: P2-S1.3 — Protect keys.php with Authentication

| Field | Value |
| :--- | :--- |
| **Story ID** | P2-S1.3 |
| **Story Name** | Protect keys.php with Authentication |
| **Epic** | P2-E01 |
| **Risk ID** | E1 (enabler) |
| **Priority** | P1 |
| **Points** | 2 |
| **Assignee** | Backend Developer |

**Objective**: Add authentication to keys.php for sensitive operations.

**Acceptance Criteria**:
- [ ] Auth required for key enumeration
- [ ] Request without auth returns 401
- [ ] Unit tests pass

**Dependencies**: None

---

### Story: P2-S1.4 — Protect status.php with Authentication

| Field | Value |
| :--- | :--- |
| **Story ID** | P2-S1.4 |
| **Story Name** | Protect status.php with Authentication |
| **Epic** | P2-E01 |
| **Risk ID** | J9 |
| **Priority** | P0 |
| **Points** | 2 |
| **Assignee** | Backend Developer |

**Objective**: Enforce auth and validate user_id matches session.

**Acceptance Criteria**:
- [ ] requireAuth() called at entry
- [ ] Status posts validate user_id === authUserId
- [ ] Request without auth returns 401
- [ ] Wrong user_id returns 403

**Dependencies**: None

---

## Epic: P2-E02 — Encrypted Backup Export

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E02 |
| **Epic Name** | Encrypted Backup Export |
| **Risk IDs** | H2 |
| **Sprint** | Sprint 1 |
| **Priority** | P0 (Blocker) |
| **Owner** | Frontend Lead |
| **LOE** | 4 hours |

### Story: P2-S2.1 — Implement Encrypted Backup Export

| Field | Value |
| :--- | :--- |
| **Story ID** | P2-S2.1 |
| **Story Name** | Implement Encrypted Backup Export |
| **Epic** | P2-E02 |
| **Risk ID** | H2 |
| **Priority** | P0 |
| **Points** | 3 |

**Objective**: Replace plaintext JSON export with password-encrypted format.

**Acceptance Criteria**:
- [ ] User prompted for password on export
- [ ] PBKDF2 key derivation (100K iterations)
- [ ] AES-256-GCM encryption
- [ ] Export blob contains: salt + iv + ciphertext
- [ ] No plaintext JSON in export file

#### Task: P2-T2.1-A — Add password prompt UI

| LOE | 30 min |

#### Task: P2-T2.1-B — Implement PBKDF2 key derivation

| LOE | 1 hour |

#### Task: P2-T2.1-C — Implement AES-GCM encryption

| LOE | 1 hour |

#### Task: P2-T2.1-D — Update createBackup() signature

| LOE | 30 min |

---

### Story: P2-S2.2 — Implement Encrypted Backup Restore

| Field | Value |
| :--- | :--- |
| **Story ID** | P2-S2.2 |
| **Story Name** | Implement Encrypted Backup Restore |
| **Epic** | P2-E02 |
| **Risk ID** | H2 |
| **Priority** | P0 |
| **Points** | 2 |

**Objective**: Update restore flow to decrypt with user password.

**Acceptance Criteria**:
- [ ] User prompted for password on restore
- [ ] Wrong password shows error
- [ ] Correct password restores keys
- [ ] Graceful error handling

---

## Epic: P2-E03 — Signed Key Bundles

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E03 |
| **Epic Name** | Signed Key Bundles |
| **Risk IDs** | E1 |
| **Sprint** | Sprint 2 |
| **Priority** | P0 |
| **Owner** | Full Stack |
| **LOE** | 16 hours |

### Story: P2-S3.1 — Implement Key Signing on Device

| Field | Value |
| :--- | :--- |
| **Story ID** | P2-S3.1 |
| **Points** | 5 |

**Objective**: Device signs its public key with identity key on registration.

**Acceptance Criteria**:
- [ ] Ed25519 identity keypair generated on first device
- [ ] Public key signed: `sig = sign(identity_priv, hash(device_uuid + public_key))`
- [ ] Signature sent with device registration

---

### Story: P2-S3.2 — Store Key Signatures in Backend

| Field | Value |
| :--- | :--- |
| **Story ID** | P2-S3.2 |
| **Points** | 3 |

**Objective**: Backend stores and returns key signatures.

**Acceptance Criteria**:
- [ ] `key_signature` column added to `user_devices`
- [ ] Signature stored on registration
- [ ] Signature returned with key fetch

---

### Story: P2-S3.3 — Verify Key Signatures on Client

| Field | Value |
| :--- | :--- |
| **Story ID** | P2-S3.3 |
| **Points** | 5 |

**Objective**: Client verifies signature before encrypting to key.

**Acceptance Criteria**:
- [ ] Signature verified on key fetch
- [ ] Invalid signature shows security warning
- [ ] User can choose to proceed or abort

---

## Epic: P2-E04 — Token Storage Hardening

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E04 |
| **Epic Name** | Token Storage Hardening |
| **Risk IDs** | T1-S-02 |
| **Sprint** | Sprint 2 |
| **Priority** | P1 |
| **LOE** | 8 hours |

### Story: P2-S4.1 — Backend Cookie Token Issuance

| Points | 3 |

**Acceptance Criteria**:
- [ ] Tokens set via Set-Cookie header
- [ ] Cookies marked HttpOnly, Secure, SameSite=Strict
- [ ] Token not in response body

---

### Story: P2-S4.2 — Frontend Token Migration

| Points | 3 |

**Acceptance Criteria**:
- [ ] Remove localStorage.setItem('access_token')
- [ ] API interceptor uses withCredentials: true
- [ ] Auth flow works without localStorage tokens

---

### Story: P2-S4.3 — CSRF Protection

| Points | 2 |

**Acceptance Criteria**:
- [ ] CSRF token set as cookie
- [ ] X-CSRF-Token header required
- [ ] Missing CSRF returns 403

---

## Epic: P2-E05 — Mobile SecureStorage

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E05 |
| **Risk IDs** | G1 |
| **Sprint** | Sprint 2 |
| **LOE** | 8 hours |

### Story: P2-S5.1 — iOS Keychain Integration

| Points | 4 |

### Story: P2-S5.2 — Android Keystore Integration

| Points | 4 |

---

## Epic: P2-E06 — Firestore Rule Hardening

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E06 |
| **Risk IDs** | I1, I2, T3-E-01 |
| **Sprint** | Sprint 2 |
| **LOE** | 4 hours |

### Story: P2-S6.1 — Audit Existing Rules

| Points | 2 |

### Story: P2-S6.2 — Deploy Hardened Rules

| Points | 2 |

---

## Epic: P2-E07 — Audit Logging Enhancement

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E07 |
| **Risk IDs** | LOGS-001 |
| **Sprint** | Sprint 2 |
| **LOE** | 4 hours |

### Story: P2-S7.1 — Add Logging to Unlogged Endpoints

| Points | 3 |

### Story: P2-S7.2 — Standardize Log Format

| Points | 2 |

---

## Epic: P2-E08 — Rate Limiting & Metrics

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E08 |
| **Risk IDs** | LOGS-002 |
| **Sprint** | Sprint 2 |
| **LOE** | 2 hours |

### Story: P2-S8.1 — Log Rate Limit Events

| Points | 2 |

---

## Epic: P2-E09 — Metadata Privacy

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E09 |
| **Risk IDs** | I1, I2 |
| **Sprint** | Sprint 3 |
| **LOE** | 8 hours |

### Story: P2-S9.1 — Encrypt lastMessage Field

| Points | 3 |

### Story: P2-S9.2 — Pad Keys Map

| Points | 2 |

---

## Epic: P2-E10 — Observability & Correlation

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E10 |
| **Risk IDs** | LOGS-003 |
| **Sprint** | Sprint 3 |
| **LOE** | 4 hours |

### Story: P2-S10.1 — Generate X-Request-ID on Client

| Points | 2 |

### Story: P2-S10.2 — Backend Correlation Logging

| Points | 2 |

---

## Epic: P2-E11 — Safety Numbers UI

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E11 |
| **Risk IDs** | E1 |
| **Sprint** | Sprint 3 |
| **LOE** | 8 hours |

### Story: P2-S11.1 — Safety Number Generation

| Points | 3 |

### Story: P2-S11.2 — QR Verification Flow

| Points | 3 |

---

## Epic: P2-E12 — Security Regression Tests

| Field | Value |
| :--- | :--- |
| **Epic ID** | P2-E12 |
| **Risk IDs** | All |
| **Sprint** | Sprint 4 |
| **LOE** | 12 hours |

### Story: P2-S12.1 — Auth Enforcement Test Suite

| Points | 3 |

### Story: P2-S12.2 — Crypto Validation Test Suite

| Points | 3 |

### Story: P2-S12.3 — Firestore Rule Test Suite

| Points | 3 |

### Story: P2-S12.4 — CI/CD Integration

| Points | 2 |

---

## Summary Statistics

| Metric | Count |
| :--- | :---: |
| Epics | 12 |
| Stories | 26 |
| Tasks | 50+ |
| Total Points | ~75 |
| Total LOE | ~91 hours |
