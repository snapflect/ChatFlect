# STRIDE Threat Model: Firebase/Firestore Layer (T3) - TASK 1.3-D

> **Version**: 1.0 | **Date**: 2026-02-06 | **Scope**: Firestore + Firebase Auth + FCM

---

## 1. Collection STRIDE Matrix

| Collection | Sensitivity | S | T | R | I | D | E | Top Threat |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `messages/{chatId}/msgs` | HIGH | - | ✓ | ✓ | ✓ | ✓ | - | Metadata leakage (I1/I2) |
| `chats/{chatId}` | MEDIUM | ✓ | ✓ | - | ✓ | - | - | Presence spoofing |
| `sync_requests/{reqId}` | HIGH | ✓ | ✓ | - | ✓ | - | ✓ | Session hijacking |
| `users/{userId}` | MEDIUM | ✓ | ✓ | - | ✓ | - | - | Profile tampering |
| `statuses/{userId}/items` | LOW | ✓ | ✓ | - | - | ✓ | - | Status impersonation |

---

## 2. Spoofing Threats

### T3-S-01: Presence Spoofing
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `chats/{chatId}.typing`, `.online` |
| **Exploited Asset** | User presence metadata |
| **Attack Vector** | Malicious writes to typing/online fields |
| **Impact** | 2 (Low) - Social engineering, stalking |
| **Likelihood** | 3 (Moderate) - If rules allow |
| **Risk Score** | 6 (LOW) |
| **Mitigation** | Strict rules: only owner writes own presence |

### T3-S-02: Sync Request Spoofing
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `sync_requests/{reqId}` |
| **Exploited Asset** | Desktop pairing handshake |
| **Attack Vector** | Create fake sync_request for victim user |
| **Impact** | 4 (High) - Unauthorized device linking |
| **Likelihood** | 2 (Low) - Requires knowledge of user flow |
| **Risk Score** | 8 (MEDIUM) |
| **Mitigation** | Authenticated creation, short TTL, explicit approval |

---

## 3. Tampering Threats

### T3-T-01: Message Metadata Tampering
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `messages/{chatId}/msgs/{msgId}` |
| **Exploited Asset** | Timestamp, senderId, deletedFor |
| **Attack Vector** | Modify timestamp to reorder, alter senderId |
| **Impact** | 3 (Moderate) - Message attribution issues |
| **Likelihood** | 2 (Low) - Rules should prevent |
| **Risk Score** | 6 (LOW) |
| **Mitigation** | Immutable fields after creation |

### T3-T-02: TTL Cleanup Abuse
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `sync_requests`, `messages` |
| **Exploited Asset** | Ephemeral data |
| **Attack Vector** | Prevent TTL cleanup, accumulate stale data |
| **Impact** | 2 (Low) - Storage bloat |
| **Likelihood** | 2 (Low) - Requires rule misconfiguration |
| **Risk Score** | 4 (LOW) |
| **Mitigation** | Scheduled cloud function cleanup |

---

## 4. Repudiation Threats

### T3-R-01: Message Deletion Without Trace
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `messages.deletedFor` field |
| **Exploited Asset** | Message history audit |
| **Attack Vector** | Delete message from own view, deny sending |
| **Impact** | 3 (Moderate) - Legal/compliance risk |
| **Likelihood** | 4 (Likely) - Normal feature behavior |
| **Risk Score** | 12 (MEDIUM) |
| **Mitigation** | Immutable audit log in separate collection |

---

## 5. Information Disclosure Threats

### T3-I-01: Chat Metadata Leakage (I1)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `chats/{chatId}.lastMessage`, `.typing`, `.unread_*` |
| **Exploited Asset** | Activity patterns |
| **Attack Vector** | Server-side visibility of plaintext metadata |
| **Impact** | 3 (Moderate) - Privacy concern |
| **Likelihood** | 5 (Almost Certain) - Inherent to design |
| **Risk Score** | 15 (HIGH) |
| **Mitigation** | Encrypt metadata fields (Phase 2) |

### T3-I-02: Fan-out Key Map Side Channel (I2)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `messages.keys` map |
| **Exploited Asset** | Device count per user |
| **Attack Vector** | Traffic analysis reveals device inventory |
| **Impact** | 3 (Moderate) - Behavioral profiling |
| **Likelihood** | 5 (Almost Certain) - Visible in every message |
| **Risk Score** | 15 (HIGH) |
| **Mitigation** | Pad key map, obfuscate device IDs |

### T3-I-03: Sync Request Private Key Exposure
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `sync_requests/{reqId}.encryptedPrivateKey` |
| **Exploited Asset** | RSA Private Key |
| **Attack Vector** | If ephemeral key compromised, decrypt private key |
| **Impact** | 5 (Critical) - Complete identity takeover |
| **Likelihood** | 2 (Low) - Requires ephemeral key theft + timing |
| **Risk Score** | 10 (MEDIUM) |
| **Mitigation** | Short TTL, delete on use, stronger ephemeral key |

---

## 6. Denial of Service Threats

### T3-D-01: Message Flood Attack
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `messages/{chatId}/msgs` |
| **Exploited Asset** | Firestore quota, client resources |
| **Attack Vector** | Rapid message submission to exhaust quotas |
| **Impact** | 3 (Moderate) - Service degradation |
| **Likelihood** | 3 (Moderate) - If rate limits weak |
| **Risk Score** | 9 (MEDIUM) |
| **Mitigation** | Firestore rules rate limiting, client debounce |

### T3-D-02: Status Flood Attack
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | `statuses/{userId}/items` |
| **Exploited Asset** | Storage, viewer feeds |
| **Attack Vector** | Create thousands of status items |
| **Impact** | 2 (Low) - UI clutter, bandwidth |
| **Likelihood** | 3 (Moderate) |
| **Risk Score** | 6 (LOW) |
| **Mitigation** | Max status count per user rule |

---

## 7. Elevation of Privilege Threats

### T3-E-01: Firestore Rules Bypass
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | All collections |
| **Exploited Asset** | Document access |
| **Attack Vector** | Exploit weak or missing security rules |
| **Impact** | 5 (Critical) - Read/write any data |
| **Likelihood** | 2 (Low) - Rules implemented but may have gaps |
| **Risk Score** | 10 (MEDIUM) |
| **Mitigation** | Comprehensive rules audit, unit test coverage |

### T3-E-02: Custom Token Scope Abuse
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | Firebase Admin SDK token issuance |
| **Exploited Asset** | Firebase Auth identity |
| **Attack Vector** | Backend issues token with wrong claims |
| **Impact** | 5 (Critical) - Identity hijacking |
| **Likelihood** | 2 (Low) - Requires backend compromise |
| **Risk Score** | 10 (MEDIUM) |
| **Mitigation** | Strict claim validation, device binding |

---

## 8. Collection Hardening Recommendations

| Collection | Current Rules | Recommended Fix |
| :--- | :--- | :--- |
| `messages` | Participants can read/write | Add immutable timestamp, sender validation |
| `chats` | Participants can update | Restrict typing/online to owner only |
| `sync_requests` | Owner can read/write | Add TTL check in rules, limit to 1 active |
| `users` | Owner can update | Add field-level restrictions |
| `statuses` | Owner can write | Add max count limit |

---

## 9. Risk ID Cross-Reference

| Threat ID | Security Assumptions ID |
| :--- | :--- |
| T3-I-01 | I1 |
| T3-I-02 | I2 |
| T3-S-02 | H1 |
| T3-I-03 | H1 |
