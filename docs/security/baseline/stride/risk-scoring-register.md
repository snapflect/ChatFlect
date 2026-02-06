# Unified Risk Scoring Register (TASK 1.3-F) - ChatFlect STRIDE

> **Version**: 1.0 | **Date**: 2026-02-06 | **Methodology**: Impact × Likelihood

---

## 1. Scoring Methodology

| Score | Impact Description | Likelihood Description |
| :---: | :--- | :--- |
| 5 | Critical - System compromise, identity takeover | Almost Certain - Trivial to exploit |
| 4 | High - Significant data breach, major disruption | Likely - Easily automated |
| 3 | Moderate - Partial data exposure, service degradation | Moderate - Requires specific conditions |
| 2 | Low - Minor impact, limited exposure | Low - Requires advanced attack |
| 1 | Minimal - Negligible impact | Rare - Highly unlikely |

**Risk Score = Impact × Likelihood (1-25)**

| Score Range | Priority | Action |
| :---: | :---: | :--- |
| 20-25 | **CRITICAL** | Immediate Phase 2 priority |
| 15-19 | **HIGH** | Phase 2 Sprint 1 |
| 10-14 | **MEDIUM** | Phase 2 Sprint 2 |
| 1-9 | **LOW** | Backlog or Accept |

---

## 2. Complete Risk Register

| Rank | Threat ID | Threat Name | Boundary | STRIDE | Impact | Likelihood | Score | Priority | Ref |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | T2-S-01 | Unauthenticated Device Registration | T2 | S, E | 5 | 5 | **25** | CRITICAL | J4 |
| 2 | T2-T-02 | Group Membership Manipulation | T2 | T, E | 4 | 5 | **20** | CRITICAL | J5 |
| 3 | T2-I-01 | Sensitive Profile Exposure | T2 | I | 4 | 5 | **20** | CRITICAL | J7 |
| 4 | T2-I-02 | Public Contact Harvesting | T2 | I | 4 | 5 | **20** | CRITICAL | J8 |
| 5 | T1-I-01 | Plaintext Backup Exposure | T1 | I | 5 | 4 | **20** | CRITICAL | H2 |
| 6 | T2-D-01 | Unauthenticated File Upload | T2 | D | 4 | 4 | **16** | HIGH | J6 |
| 7 | T1-S-02 | Token Theft via XSS | T1 | S, I | 5 | 3 | **15** | HIGH | - |
| 8 | T1-I-02 | SQLite Plaintext Cache | T1 | I | 5 | 3 | **15** | HIGH | G1 |
| 9 | T1-E-01 | XSS to Full Token Takeover | T1 | E | 5 | 3 | **15** | HIGH | - |
| 10 | T2-S-02 | Identity Spoofing in Status | T2 | S | 3 | 5 | **15** | HIGH | J9 |
| 11 | T2-T-01 | Backend Key Injection | T2 | T | 5 | 3 | **15** | HIGH | E1 |
| 12 | T2-D-02 | Brute Force OTP Abuse | T2 | D | 5 | 3 | **15** | HIGH | - |
| 13 | T3-I-01 | Chat Metadata Leakage | T3 | I | 3 | 5 | **15** | HIGH | I1 |
| 14 | T3-I-02 | Fan-out Key Map Side Channel | T3 | I | 3 | 5 | **15** | HIGH | I2 |
| 15 | CP-01 | Backend Key Injection (E1) | Crypto | T | 5 | 3 | **15** | HIGH | E1 |
| 16 | CP-06 | Missing Key Signatures | Crypto | T | 5 | 3 | **15** | HIGH | - |
| 17 | T1-T-01 | localStorage Manipulation | T1 | T | 4 | 3 | **12** | MEDIUM | - |
| 18 | T1-S-01 | Device Impersonation | T1 | S | 4 | 3 | **12** | MEDIUM | - |
| 19 | T2-E-01 | JWT Replay Attack | T2 | E | 4 | 3 | **12** | MEDIUM | - |
| 20 | T2-E-02 | Device Registration Abuse | T2 | E | 3 | 4 | **12** | MEDIUM | - |
| 21 | T3-R-01 | Message Deletion Without Trace | T3 | R | 3 | 4 | **12** | MEDIUM | - |
| 22 | CP-07 | Missing Key Transparency Log | Crypto | R | 4 | 3 | **12** | MEDIUM | - |
| 23 | T1-S-03 | Ratchet State Clone | T1 | S, I | 5 | 2 | **10** | MEDIUM | - |
| 24 | T1-E-02 | CryptoService API Abuse | T1 | E | 5 | 2 | **10** | MEDIUM | - |
| 25 | T3-I-03 | Sync Request Key Exposure | T3 | I | 5 | 2 | **10** | MEDIUM | H1 |
| 26 | T3-E-01 | Firestore Rules Bypass | T3 | E | 5 | 2 | **10** | MEDIUM | - |
| 27 | T3-E-02 | Custom Token Scope Abuse | T3 | E | 5 | 2 | **10** | MEDIUM | - |
| 28 | CP-02 | Key Substitution Attack | Crypto | T | 5 | 2 | **10** | MEDIUM | - |
| 29 | CP-03 | Ratchet State Compromise | Crypto | I | 5 | 2 | **10** | MEDIUM | - |
| 30 | T1-R-02 | Key Rotation Without Evidence | T1 | R | 3 | 3 | **9** | MEDIUM | - |
| 31 | T3-D-01 | Message Flood Attack | T3 | D | 3 | 3 | **9** | MEDIUM | - |
| 32 | T1-R-01 | Missing Client Audit Logs | T1 | R | 2 | 4 | **8** | MEDIUM | - |
| 33 | T1-I-03 | Memory Dump Key Extraction | T1 | I | 4 | 2 | **8** | MEDIUM | - |
| 34 | T3-S-02 | Sync Request Spoofing | T3 | S | 4 | 2 | **8** | MEDIUM | H1 |
| 35 | CP-04 | Downgrade Attack (v2→v1) | Crypto | T | 4 | 2 | **8** | MEDIUM | - |
| 36 | T1-T-02 | SQLite Cache Poisoning | T1 | T | 3 | 2 | **6** | LOW | - |
| 37 | T1-D-02 | Ratchet Exhaustion Attack | T1 | D | 3 | 2 | **6** | LOW | - |
| 38 | T3-S-01 | Presence Spoofing | T3 | S | 2 | 3 | **6** | LOW | - |
| 39 | T3-T-01 | Message Metadata Tampering | T3 | T | 3 | 2 | **6** | LOW | - |
| 40 | T3-D-02 | Status Flood Attack | T3 | D | 2 | 3 | **6** | LOW | - |
| 41 | CP-05 | Ciphertext Replay | Crypto | T | 2 | 3 | **6** | LOW | - |
| 42 | T1-T-03 | Backup JSON Tampering | T1 | T | 5 | 1 | **5** | LOW | - |
| 43 | T3-T-02 | TTL Cleanup Abuse | T3 | T | 2 | 2 | **4** | LOW | - |

---

## 3. Top 10 Critical Threats

| Rank | ID | Threat | Score | Justification |
| :---: | :---: | :--- | :---: | :--- |
| 1 | J4 | Unauthenticated Device Registration | 25 | Trivial exploit, complete E2EE bypass |
| 2 | J5 | Group Membership Manipulation | 20 | No auth on group management |
| 3 | J7 | Sensitive Profile Exposure | 20 | PII exposed to anyone |
| 4 | J8 | Public Contact Harvesting | 20 | Entire user directory harvestable |
| 5 | H2 | Plaintext Backup Exposure | 20 | Private key in unencrypted JSON |
| 6 | J6 | Unauthenticated File Upload | 16 | Storage DoS attack |
| 7 | E1 | Backend Key Injection | 15 | MITM via compromised backend |
| 8 | G1 | SQLite Plaintext Cache | 15 | Decrypted messages on disk |
| 9 | I1/I2 | Metadata Leakage | 15 | Activity patterns visible |
| 10 | J9 | Identity Spoofing | 15 | No user_id validation |

---

## 4. Security Assumptions Cross-Reference

| Risk ID | Security Assumptions Reference |
| :---: | :--- |
| J4 | `security-assumptions.md#Risk-J4` |
| J5 | `security-assumptions.md#Risk-J5` |
| J6 | `security-assumptions.md#Risk-J6` |
| J7 | `security-assumptions.md#Risk-J7` |
| J8 | `security-assumptions.md#Risk-J8` |
| J9 | `security-assumptions.md#Risk-J9` |
| E1 | `security-assumptions.md#Risk-E1` |
| H2 | `security-assumptions.md#Risk-H2` |
| G1 | `security-assumptions.md#Risk-G1` |
| I1 | `security-assumptions.md#Risk-I1` |
| I2 | `security-assumptions.md#Risk-I2` |

---

## 5. Phase 2 Epic Mapping

| Priority | Threats | Epic Name |
| :---: | :--- | :--- |
| CRITICAL | J4, J5, J6, J7, J8, J9 | Backend Authentication Enforcement |
| CRITICAL | H2 | Encrypted Backup System |
| HIGH | E1, CP-06 | Signed Key Bundles + Safety Numbers |
| HIGH | G1 | SQLCipher Encryption |
| HIGH | I1, I2 | Metadata Privacy Enhancement |
| HIGH | T1-S-02, T1-E-01 | XSS Hardening + Token Migration |
| MEDIUM | CP-07 | Key Transparency Log |
| MEDIUM | T3-E-01 | Firestore Rules Audit |
