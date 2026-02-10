# Phase 2 Sprint Execution Plan (TASK 1.5-E) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Classification**: Engineering Roadmap

---

## Sprint Overview

| Sprint | Duration | Goal | Epics | LOE |
| :---: | :---: | :--- | :--- | :---: |
| Sprint 1 | 2 weeks | Eliminate CRITICAL auth gaps | P2-E01, P2-E02 | 18h |
| Sprint 2 | 2 weeks | Harden crypto & token storage | P2-E03, P2-E04, P2-E05, P2-E06, P2-E07, P2-E08 | 42h |
| Sprint 3 | 2 weeks | Privacy & observability | P2-E09, P2-E10, P2-E11 | 20h |
| Sprint 4 | 2 weeks | Regression testing & release | P2-E12, Release | 16h |

**Total**: 8 weeks, ~96 engineering hours

---

## Sprint 1: Critical Auth Enforcement (Weeks 1-2)

### Sprint Goal
Eliminate all CRITICAL authentication vulnerabilities. No unauthenticated API access to sensitive endpoints.

### Epics

| Epic | Stories | LOE | Owner |
| :--- | :--- | :---: | :--- |
| P2-E01: Backend Auth Enforcement | 4 | 9h | Backend |
| P2-E02: Encrypted Backup Export | 2 | 4h | Frontend |

### Deliverables

| # | Deliverable | Epic |
| :---: | :--- | :---: |
| 1 | devices.php protected with auth | P2-E01 |
| 2 | upload.php protected with auth + quotas | P2-E01 |
| 3 | status.php protected with auth | P2-E01 |
| 4 | keys.php protected with auth | P2-E01 |
| 5 | Encrypted backup export working | P2-E02 |
| 6 | Backup restore with password working | P2-E02 |

### Dependencies
- None (Sprint 1 fixes are independent)

### Testing Plan

| Test Type | Scope | Tool |
| :--- | :--- | :--- |
| Unit Tests | Auth middleware | PHPUnit |
| API Tests | 401/403 responses | Postman |
| Security Tests | Burp replay | Burp Suite |
| Manual Tests | Backup flow | Manual |

### Sprint 1 Exit Criteria
- [ ] All 4 endpoints return 401 without auth
- [ ] All 4 endpoints return 403 for wrong user_id
- [ ] Backup export produces non-JSON blob
- [ ] Backup restore with wrong password fails
- [ ] Security Lead sign-off

---

## Sprint 2: Crypto & Storage Hardening (Weeks 3-4)

### Sprint Goal
Implement signed key bundles, HTTP-Only cookies, SecureStorage, and Firestore rule hardening.

### Epics

| Epic | Stories | LOE | Owner |
| :--- | :--- | :---: | :--- |
| P2-E03: Signed Key Bundles | 3 | 16h | Full Stack |
| P2-E04: Token Storage Hardening | 3 | 8h | Full Stack |
| P2-E05: Mobile SecureStorage | 2 | 8h | Mobile |
| P2-E06: Firestore Rule Hardening | 2 | 4h | Firebase |
| P2-E07: Audit Logging Enhancement | 2 | 4h | Backend |
| P2-E08: Rate Limiting & Metrics | 1 | 2h | Backend |

### Deliverables

| # | Deliverable | Epic |
| :---: | :--- | :---: |
| 1 | Key signatures stored and verified | P2-E03 |
| 2 | Key injection detected with warning | P2-E03 |
| 3 | Tokens in HTTP-Only cookies | P2-E04 |
| 4 | CSRF protection implemented | P2-E04 |
| 5 | Keys in iOS Keychain | P2-E05 |
| 6 | Keys in Android Keystore | P2-E05 |
| 7 | Firestore rules hardened | P2-E06 |
| 8 | Comprehensive audit logging | P2-E07 |
| 9 | Rate limit metrics | P2-E08 |

### Dependencies

```
P2-E03 (Signed Keys) ─────► Requires P2-E01 (auth on keys.php)
P2-E04 (HTTP-Only)   ─────► Backend cookie support + frontend migration
P2-E05 (SecureStorage) ──► Mobile build verification
P2-E06 (Firestore)   ─────► Firebase project access
```

### Testing Plan

| Test Type | Scope | Tool |
| :--- | :--- | :--- |
| Unit Tests | Crypto signing | Jest |
| Integration Tests | Cookie auth flow | Cypress |
| Mobile Tests | Keychain/Keystore | Appium |
| Firebase Tests | Rule validation | Emulator |
| Security Tests | XSS simulation | Manual |

### Sprint 2 Exit Criteria
- [ ] Key tampering shows security warning
- [ ] localStorage.getItem('access_token') === null
- [ ] Mobile keys in native storage
- [ ] Firestore cross-user read fails
- [ ] All endpoints log security events
- [ ] Security Lead sign-off

---

## Sprint 3: Privacy & Observability (Weeks 5-6)

### Sprint Goal
Implement metadata privacy, correlation IDs, and Safety Numbers UI.

### Epics

| Epic | Stories | LOE | Owner |
| :--- | :--- | :---: | :--- |
| P2-E09: Metadata Privacy | 2 | 8h | Frontend |
| P2-E10: Observability & Correlation | 2 | 4h | Full Stack |
| P2-E11: Safety Numbers UI | 2 | 8h | Frontend |

### Deliverables

| # | Deliverable | Epic |
| :---: | :--- | :---: |
| 1 | Encrypted lastMessage field | P2-E09 |
| 2 | Padded keys map | P2-E09 |
| 3 | X-Request-ID propagation | P2-E10 |
| 4 | Correlation in all logs | P2-E10 |
| 5 | Safety numbers displayed | P2-E11 |
| 6 | QR verification working | P2-E11 |

### Dependencies

```
P2-E09 (Metadata) ─────► Requires P2-E04 (message encryption already works)
P2-E10 (Correlation) ──► Full stack coordination
P2-E11 (Safety Numbers) ► Requires P2-E03 (identity keys)
```

### Testing Plan

| Test Type | Scope | Tool |
| :--- | :--- | :--- |
| Unit Tests | Metadata encryption | Jest |
| E2E Tests | QR verification | Cypress |
| Log Tests | Correlation traces | Manual |

### Sprint 3 Exit Criteria
- [ ] Firestore shows encrypted metadata
- [ ] Keys map padded to fixed size
- [ ] All logs include correlation ID
- [ ] Safety numbers match on both devices
- [ ] Security Lead sign-off

---

## Sprint 4: Regression Tests & Release (Weeks 7-8)

### Sprint Goal
Create comprehensive security regression tests and prepare for production release.

### Epics

| Epic | Stories | LOE | Owner |
| :--- | :--- | :---: | :--- |
| P2-E12: Security Regression Tests | 4 | 12h | QA |
| Release Preparation | - | 4h | All |

### Deliverables

| # | Deliverable | Epic |
| :---: | :--- | :---: |
| 1 | Auth enforcement test suite | P2-E12 |
| 2 | Crypto validation test suite | P2-E12 |
| 3 | Firestore rule test suite | P2-E12 |
| 4 | CI/CD integration | P2-E12 |
| 5 | Release checklist completed | Release |
| 6 | Sign-off signatures collected | Release |

### Dependencies

```
P2-E12 (Tests) ─────► All previous epics complete
Release ────────────► All tests passing
```

### Testing Plan

| Test Type | Scope | Tool |
| :--- | :--- | :--- |
| Regression Tests | All security fixes | Jest/PHPUnit |
| Penetration Test | Full app | Burp Suite |
| Acceptance Tests | Security gates | Manual |

### Sprint 4 Exit Criteria
- [ ] All regression tests passing
- [ ] CI/CD runs security tests on PR
- [ ] Penetration test report clear
- [ ] Release gate checklist complete
- [ ] CTO + Security Lead sign-off

---

## Time Estimates Summary

### By Epic

| Epic | Estimated Hours | Sprint |
| :--- | :---: | :---: |
| P2-E01 | 9 | 1 |
| P2-E02 | 4 | 1 |
| P2-E03 | 16 | 2 |
| P2-E04 | 8 | 2 |
| P2-E05 | 8 | 2 |
| P2-E06 | 4 | 2 |
| P2-E07 | 4 | 2 |
| P2-E08 | 2 | 2 |
| P2-E09 | 8 | 3 |
| P2-E10 | 4 | 3 |
| P2-E11 | 8 | 3 |
| P2-E12 | 12 | 4 |
| Release | 4 | 4 |
| **TOTAL** | **91** | - |

### By Sprint

| Sprint | Hours | Weeks | Team Size | Velocity |
| :---: | :---: | :---: | :---: | :---: |
| Sprint 1 | 13 | 2 | 2 | 6.5h/week/dev |
| Sprint 2 | 42 | 2 | 3 | 7h/week/dev |
| Sprint 3 | 20 | 2 | 2 | 5h/week/dev |
| Sprint 4 | 16 | 2 | 2 | 4h/week/dev |

---

## Risk & Mitigation

| Risk | Probability | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| Cookie auth breaks mobile | Medium | High | Test on mobile early Sprint 2 |
| Key signing complexity | Medium | Medium | Defer transparency log to Phase 3 |
| Firestore rules break app | Low | High | Test in emulator first |
| CSRF breaks third-party integration | Low | Medium | Whitelist verified origins |

---

## Gantt Chart (Simplified)

```
Week:  1      2      3      4      5      6      7      8
       ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
Sprint 1 ██████████████
         E01   E02
              
Sprint 2             ██████████████████████████████
                     E03     E04    E05   E06-08

Sprint 3                                   ██████████████
                                           E09   E10  E11

Sprint 4                                               ████████
                                                       E12  REL
```

---

## Stakeholder Responsibilities

| Role | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
| :--- | :---: | :---: | :---: | :---: |
| Backend Lead | E01 | E03, E07, E08 | E10 | Review |
| Frontend Lead | E02 | E04, E05 | E09, E11 | Review |
| Mobile Lead | - | E05 | - | Review |
| Firebase Admin | - | E06 | - | Deploy |
| Security Lead | Review | Review | Review | Final Sign-off |
| QA Lead | Test | Test | Test | E12 |
| CTO | - | - | - | Final Sign-off |
