# STRIDE Threat Model: Backend API Layer (T2) - TASK 1.3-C

> **Version**: 1.0 | **Date**: 2026-02-06 | **Scope**: PHP API + MySQL (Semi-Trusted)

---

## 1. Endpoint STRIDE Matrix

| Endpoint | Auth Required | Current State | S | T | R | I | D | E | Top Risk |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `devices.php` | ✓ | ❌ None | ✓ | ✓ | - | ✓ | ✓ | ✓ | J4 - Rogue device |
| `keys.php` | ✓ | ❌ None | ✓ | ✓ | - | ✓ | - | - | E1 - Key injection |
| `groups.php` | ✓ | ❌ None | ✓ | ✓ | - | ✓ | - | ✓ | J5 - Group hijack |
| `upload.php` | ✓ | ❌ None | - | ✓ | - | - | ✓ | - | J6 - Storage abuse |
| `profile.php` | ✓ | ❌ Partial | ✓ | ✓ | - | ✓ | - | - | J7 - PII exposure |
| `contacts.php` | ✓ | ❌ None | - | - | - | ✓ | - | - | J8 - Harvesting |
| `status.php` | ✓ | ❌ None | ✓ | ✓ | - | - | ✓ | - | J9 - Spoofing |
| `firebase_auth.php` | ✓ | ✓ PHP Session | ✓ | - | - | - | - | ✓ | Token hijack |
| `refresh_token.php` | ✓ | ✓ Token-based | ✓ | - | - | - | - | - | Replay attack |

---

## 2. Spoofing Threats

### T2-S-01: Unauthenticated Device Registration (J4)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `devices.php?action=register` |
| **Required Auth** | JWT/Session |
| **Current Gap** | No authentication check |
| **Exploit Example** | POST `{user_id: "victim", publicKey: "attacker_key"}` |
| **Impact** | 5 (Critical) - Attacker receives all future E2EE messages |
| **Likelihood** | 5 (Almost Certain) - Trivial to exploit |
| **Risk Score** | 25 (CRITICAL) |
| **Mitigation** | Add JWT validation, rate limiting, device attestation |

### T2-S-02: Identity Spoofing in Status (J9)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `status.php` |
| **Required Auth** | JWT/Session |
| **Current Gap** | No user_id validation |
| **Exploit Example** | POST status as any user_id |
| **Impact** | 3 (Moderate) - Social engineering, impersonation |
| **Likelihood** | 5 (Almost Certain) - No validation |
| **Risk Score** | 15 (HIGH) |
| **Mitigation** | Bind user_id to authenticated session |

---

## 3. Tampering Threats

### T2-T-01: Backend Key Injection (E1) 🚨
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `keys.php`, MySQL `users.primaryKey` |
| **Required Auth** | Admin access or API compromise |
| **Current Gap** | No key signature verification |
| **Exploit Example** | Compromised backend replaces victim's public key |
| **Impact** | 5 (Critical) - MITM on all future messages |
| **Likelihood** | 3 (Moderate) - Requires backend compromise |
| **Risk Score** | 15 (HIGH) |
| **Mitigation** | Signed key bundles, client-side Safety Numbers |

### T2-T-02: Group Membership Manipulation (J5)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `groups.php?action=add_member` |
| **Required Auth** | Group admin role |
| **Current Gap** | No authentication |
| **Exploit Example** | Add attacker to any group with known groupId |
| **Impact** | 4 (High) - Unauthorized group access |
| **Likelihood** | 5 (Almost Certain) - Trivial |
| **Risk Score** | 20 (CRITICAL) |
| **Mitigation** | JWT validation + role check |

---

## 4. Information Disclosure Threats

### T2-I-01: Sensitive Profile Exposure (J7)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `profile.php?action=get&user_id=X` |
| **Required Auth** | Yes |
| **Current Gap** | Returns email, phone for any user_id |
| **Exploit Example** | Enumerate all users, harvest PII |
| **Impact** | 4 (High) - PII breach, GDPR violation |
| **Likelihood** | 5 (Almost Certain) - Public endpoint |
| **Risk Score** | 20 (CRITICAL) |
| **Mitigation** | Authenticate, return only self or contacts |

### T2-I-02: Public Contact Harvesting (J8)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `contacts.php?search=*` |
| **Required Auth** | Yes |
| **Current Gap** | Wildcard search returns entire directory |
| **Exploit Example** | Bulk harvest phone numbers |
| **Impact** | 4 (High) - User list exposure |
| **Likelihood** | 5 (Almost Certain) - No auth |
| **Risk Score** | 20 (CRITICAL) |
| **Mitigation** | Rate limit, authenticate, limit results |

---

## 5. Denial of Service Threats

### T2-D-01: Unauthenticated File Upload Abuse (J6)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `upload.php` |
| **Required Auth** | Yes |
| **Current Gap** | No authentication |
| **Exploit Example** | Upload TB of data, exhaust storage |
| **Impact** | 4 (High) - Storage exhaustion, cost attack |
| **Likelihood** | 4 (Likely) - Easy to automate |
| **Risk Score** | 16 (HIGH) |
| **Mitigation** | JWT validation, upload quotas |

### T2-D-02: Brute Force OTP Abuse
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `profile.php?action=confirm_otp` |
| **Required Auth** | OTP |
| **Current Gap** | No rate limiting |
| **Exploit Example** | Brute force 6-digit OTP in ~1M attempts |
| **Impact** | 5 (Critical) - Account takeover |
| **Likelihood** | 3 (Moderate) - Requires automation |
| **Risk Score** | 15 (HIGH) |
| **Mitigation** | Rate limit, lockout, OTP expiry |

---

## 6. Elevation of Privilege Threats

### T2-E-01: JWT Replay Attack
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | All authenticated endpoints |
| **Required Auth** | Valid JWT |
| **Current Gap** | Long-lived tokens, no jti tracking |
| **Exploit Example** | Steal JWT, use indefinitely |
| **Impact** | 4 (High) - Persistent access |
| **Likelihood** | 3 (Moderate) - Requires token theft |
| **Risk Score** | 12 (MEDIUM) |
| **Mitigation** | Short expiry, refresh rotation, jti blacklist |

### T2-E-02: Privilege Escalation via Device Registration
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `devices.php?action=register` |
| **Required Auth** | Yes |
| **Current Gap** | No max device limit enforcement |
| **Exploit Example** | Register thousands of devices |
| **Impact** | 3 (Moderate) - Resource exhaustion |
| **Likelihood** | 4 (Likely) - No limits |
| **Risk Score** | 12 (MEDIUM) |
| **Mitigation** | Device count limits, LRU eviction |

---

## 7. Risk Summary (J4-J9)

| Risk ID | Threat | STRIDE | Risk Score | Priority |
| :---: | :--- | :---: | :---: | :---: |
| **J4** | Unauthenticated Device Registration | S, E | 25 | CRITICAL |
| **J5** | Broken Group Access Control | T, E | 20 | CRITICAL |
| **J6** | Unauthenticated File Uploads | D | 16 | HIGH |
| **J7** | Sensitive Profile Exposure | I | 20 | CRITICAL |
| **J8** | Public Contact Harvesting | I | 20 | CRITICAL |
| **J9** | Identity Spoofing in Status | S | 15 | HIGH |
| **E1** | Backend Key Injection | T | 15 | HIGH |

---

## 8. Mitigation Recommendations

| Gap | Recommended Fix | Effort | Phase |
| :--- | :--- | :---: | :---: |
| No auth on devices.php | Add JWT middleware | M | Phase 2 Sprint 1 |
| No auth on keys.php | Add JWT middleware | M | Phase 2 Sprint 1 |
| No auth on groups.php | Add JWT + role check | M | Phase 2 Sprint 1 |
| No auth on upload.php | Add JWT + quotas | M | Phase 2 Sprint 1 |
| No auth on profile/contacts | Add JWT + scope limits | M | Phase 2 Sprint 1 |
| No OTP rate limiting | Add Redis rate limiter | S | Phase 2 Sprint 1 |
| No key signatures | Implement signed bundles | L | Phase 2 Sprint 2 |
