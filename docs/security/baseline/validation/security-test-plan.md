# Security Validation Test Plan (TASK 1.4-A) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Status**: P0

---

## 1. Validation Scope

### 1.1 In-Scope

| Category | Coverage |
| :--- | :--- |
| Authentication Flows | OTP → PHP JWT → Firebase Token lifecycle |
| Device Provisioning | RSA generation, registration, eviction |
| E2EE Message Send | AES encryption, key fan-out, outbox |
| E2EE Message Receive | Listener, decryption, failure states |
| Multi-Device Sync | QR linking, ephemeral key exchange |
| Token Security | localStorage storage, replay attacks |
| Backend API Auth | Endpoint authentication enforcement |
| Firestore Rules | Access control validation |
| Crypto Protocol | Key injection, backup, downgrade attacks |
| Logging/Telemetry | Audit readiness assessment |

### 1.2 Out-of-Scope

- Full penetration testing (Phase 3)
- Load/stress testing
- Phase 2 mitigation implementation
- Third-party dependency audits

---

## 2. Test Environments

| Environment | URL | Purpose |
| :--- | :---: | :--- |
| **DEV** | `https://snapflect.com/api/` | Primary validation target |
| **Firebase (PROD)** | Firebase Console | Firestore rules, Auth |
| **Local** | `localhost:4200` | Client-side analysis |

### 2.1 Firebase Project Configuration

| Setting | Expected Value |
| :--- | :--- |
| Project ID | `chatflect-prod` (or similar) |
| Auth Providers | Phone, Email/Password |
| Firestore Region | `us-central1` |
| Security Rules | Deployed and active |

---

## 3. Test User & Device Setup

### 3.1 Test Users

| User ID | Role | Purpose |
| :--- | :--- | :--- |
| `test-user-1` | Primary | Main validation user |
| `test-user-2` | Secondary | Cross-user access tests |
| `test-attacker` | Adversary | Attack simulations |

### 3.2 Device Setup

| Device | Platform | Purpose |
| :--- | :--- | :--- |
| Device A | Web (Chrome) | Primary client |
| Device B | Web (Chrome Incognito) | Secondary device |
| Device C | Mobile (Android) | Mobile validation |
| Device D | Desktop (Electron) | Sync validation |

---

## 4. Required Tools

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| **Chrome DevTools** | Latest | Network inspection, localStorage |
| **Postman** | Latest | API endpoint testing |
| **Burp Suite Community** | 2024.x | Request interception |
| **Firebase Emulator** | Latest | Local rules testing |
| **Git** | Latest | Code inspection |
| **VS Code** | Latest | Code analysis |

---

## 5. Test Case Mapping

### 5.1 STORY-1.1 Flow Mapping

| Flow Document | Test Tasks |
| :--- | :--- |
| [auth-flow.md](../auth-flow.md) | 1.4-B |
| [device-provisioning-flow.md](../device-provisioning-flow.md) | 1.4-C |
| [message-send-flow.md](../message-send-flow.md) | 1.4-D |
| [message-receive-flow.md](../message-receive-flow.md) | 1.4-E |
| [multi-device-sync-flow.md](../multi-device-sync-flow.md) | 1.4-F |

### 5.2 STORY-1.2 Crypto Asset Mapping

| Crypto Asset | Test Tasks |
| :--- | :--- |
| Master RSA Private Key | 1.4-C, 1.4-F, 1.4-J (H2) |
| Device RSA Key Pair | 1.4-C, 1.4-D |
| AES-256-GCM Session Key | 1.4-D, 1.4-E |
| Ephemeral Sync Key | 1.4-F |
| Firebase Tokens | 1.4-B, 1.4-G |
| PHP JWT | 1.4-B, 1.4-H |

### 5.3 STORY-1.3 STRIDE Risk Mapping

| Risk ID | Threat | Test Tasks |
| :---: | :--- | :--- |
| **J4** | Unauthenticated Device Registration | 1.4-H |
| **J5** | Group Membership Manipulation | 1.4-H |
| **J6** | Unauthenticated File Upload | 1.4-H |
| **J7** | Sensitive Profile Exposure | 1.4-H |
| **J8** | Public Contact Harvesting | 1.4-H |
| **J9** | Identity Spoofing in Status | 1.4-H |
| **E1** | Backend Key Injection | 1.4-J |
| **H2** | Plaintext Backup Exposure | 1.4-J |
| **G1** | SQLite Plaintext Cache | 1.4-G |
| **I1/I2** | Metadata Leakage | 1.4-I |
| **T1-S-02** | Token Theft via XSS | 1.4-G |

---

## 6. Test Case Summary

| Task | Test Cases | Priority |
| :--- | :---: | :---: |
| 1.4-B: Auth Flow | 8 | P0 |
| 1.4-C: Device Provisioning | 6 | P0 |
| 1.4-D: E2EE Send | 6 | P0 |
| 1.4-E: E2EE Receive | 6 | P0 |
| 1.4-F: Multi-Device Sync | 5 | P0 |
| 1.4-G: Token Storage | 5 | P0 |
| 1.4-H: Backend Auth | 9 | P0 |
| 1.4-I: Firestore Rules | 7 | P0 |
| 1.4-J: Crypto Attacks | 4 | P0 |
| 1.4-K: Logging Audit | 8 | P0 |
| **Total** | **64** | |

---

## 7. Execution Strategy

### 7.1 Phase 1: Documentation Review (Current)
- Review all STORY-1.1, 1.2, 1.3 artifacts
- Create test cases per task
- Prepare test environment

### 7.2 Phase 2: Passive Validation
- Code inspection for crypto, auth, storage
- Firestore rules analysis
- Backend endpoint inventory verification

### 7.3 Phase 3: Active Validation
- Execute test cases with evidence capture
- Simulate attack scenarios
- Document findings

### 7.4 Phase 4: Reporting
- Compile all results
- Create consolidated report
- Prepare sign-off documentation

---

## 8. Evidence Requirements

| Evidence Type | Format | Storage |
| :--- | :--- | :--- |
| Network captures | HAR / Screenshot | `/validation/evidence/` |
| Console logs | Text / Screenshot | `/validation/evidence/` |
| Firestore snapshots | JSON / Screenshot | `/validation/evidence/` |
| Code snippets | Markdown | Inline in reports |
| API responses | JSON | Inline in reports |

---

## 9. Risk-Based Prioritization

| Priority | Test Focus | Rationale |
| :---: | :--- | :--- |
| **P0** | Backend Auth (J4-J9) | CRITICAL risks, trivial exploit |
| **P0** | Token Storage (G1) | HIGH risk, privacy impact |
| **P0** | Crypto Protocol (E1, H2) | HIGH risk, E2EE integrity |
| **P1** | Firestore Rules | MEDIUM risk, defense in depth |
| **P1** | Logging Readiness | Operational security |

---

## 10. Deliverables Checklist

| Deliverable | Status |
| :--- | :---: |
| security-test-cases.md | ⏳ |
| backend-auth-verification-report.md | ⏳ |
| firestore-rule-validation-report.md | ⏳ |
| token-lifecycle-validation-report.md | ⏳ |
| crypto-runtime-validation-report.md | ⏳ |
| abuse-simulation-report.md | ⏳ |
| logging-telemetry-gap-report.md | ⏳ |
| runtime-validation-report.md | ⏳ |
| story-1.4-signoff.md | ⏳ |
