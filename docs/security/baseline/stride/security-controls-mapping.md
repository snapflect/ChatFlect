# Security Controls Mapping (TASK 1.3-H) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-06 | **Frameworks**: OWASP ASVS, NIST 800-53, CIS

---

## 1. Mitigation to Control Mapping

| Epic | Mitigation | OWASP ASVS | NIST 800-53 | CIS Control |
| :---: | :--- | :--- | :--- | :--- |
| E1 | JWT Authentication on APIs | V4.1.1 | IA-2 | 3.3 |
| E1 | Role-Based Access Control | V4.2.1 | AC-6 | 3.3 |
| E2 | Encrypted Backups | V6.2.1 | SC-28 | 13.1 |
| E3 | Signed Key Bundles | V6.2.5 | SC-17 | 14.4 |
| E3 | Safety Numbers | V9.2.3 | IA-9 | - |
| E4 | SQLCipher Encryption | V6.2.3 | SC-28 | 13.1 |
| E5 | HTTP-Only Token Cookies | V3.4.1 | SC-8 | 16.9 |
| E5 | CSRF Protection | V4.2.2 | AC-3 | 16.9 |
| E6 | Encrypted Metadata | V6.2.1 | SC-8 | 13.3 |
| E7 | Rate Limiting | V11.1.4 | SC-5 | 13.10 |
| E7 | OTP Throttling | V2.2.1 | AC-7 | 16.13 |
| E8 | Firestore Rules Lockdown | V4.1.5 | AC-3 | 14.6 |
| E9 | Audit Logging | V7.1.1 | AU-2 | 8.2 |
| E10 | Key Transparency | V6.2.5 | SC-17 | - |

---

## 2. OWASP ASVS Mapping

| ASVS Control | Requirement | Current State | Phase 2 Fix |
| :---: | :--- | :---: | :--- |
| V2.2.1 | OTP should have lockout | ❌ | E7 - OTP throttling |
| V3.4.1 | Tokens in HTTP-Only cookies | ❌ | E5 - Token migration |
| V4.1.1 | API authentication | ❌ | E1 - JWT middleware |
| V4.1.5 | Access control on every request | ❌ | E1 - Auth enforcement |
| V4.2.1 | Least privilege access | ❌ | E1 - RBAC |
| V4.2.2 | CSRF protection | ❌ | E5 - CSRF tokens |
| V6.2.1 | Data encryption at rest | ⚠️ Partial | E2, E4, E6 |
| V6.2.3 | Sensitive data encrypted | ⚠️ Partial | E4 - SQLCipher |
| V6.2.5 | Key management | ⚠️ Partial | E3or E10 |
| V7.1.1 | Audit logging | ❌ | E9 |
| V9.2.3 | Key verification | ❌ | E3 - Safety Numbers |
| V11.1.4 | Anti-automation | ❌ | E7 - Rate limiting |

---

## 3. NIST 800-53 Mapping

| Control | Description | Implementation |
| :---: | :--- | :--- |
| **AC-3** | Access Enforcement | E1 - JWT auth on all endpoints |
| **AC-6** | Least Privilege | E1 - Role-based group management |
| **AC-7** | Unsuccessful Login Attempts | E7 - OTP lockout after 5 failures |
| **AU-2** | Auditable Events | E9 - Log all security events |
| **IA-2** | Identification and Authentication | E1 - JWT/Session validation |
| **IA-9** | Service Identification | E3 - Safety Numbers |
| **SC-5** | Denial of Service Protection | E7 - Rate limiting |
| **SC-8** | Transmission Confidentiality | E5, E6 - Token/metadata encryption |
| **SC-17** | Public Key Infrastructure | E3 - Signed key bundles |
| **SC-28** | Protection of Information at Rest | E2, E4 - Backup/cache encryption |

---

## 4. CIS Controls Mapping

| CIS # | Control | Current | Target |
| :---: | :--- | :---: | :---: |
| 3.3 | Configure Data Access Control | ❌ | ✓ (E1) |
| 8.2 | Audit Log Management | ❌ | ✓ (E9) |
| 13.1 | Data Protection | ⚠️ | ✓ (E2, E4) |
| 13.3 | Encrypt Sensitive Data | ⚠️ | ✓ (E6) |
| 13.10 | Manage Access to Cloud Apps | ❌ | ✓ (E7, E8) |
| 14.4 | Protect Against Data Leaks | ⚠️ | ✓ (E3) |
| 14.6 | Configure Access Control | ⚠️ | ✓ (E8) |
| 16.9 | Session Management | ❌ | ✓ (E5) |
| 16.13 | Login Attempt Protection | ❌ | ✓ (E7) |

---

## 5. Compliance Readiness Summary

| Framework | Current Coverage | Post-Phase 2 |
| :--- | :---: | :---: |
| OWASP ASVS L1 | 45% | 85% |
| OWASP ASVS L2 | 30% | 70% |
| NIST 800-53 (Moderate) | 40% | 75% |
| CIS Controls v8 | 35% | 70% |
| SOC2 Type II | 25% | 60% |
