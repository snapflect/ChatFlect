# STRIDE Threat Model: Client Layer (T1) - TASK 1.3-B

> **Version**: 1.0 | **Date**: 2026-02-06 | **Scope**: Untrusted Edge (Web/Mobile/Desktop)

---

## 1. Spoofing Threats

### T1-S-01: Device Impersonation via UUID Theft
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | localStorage `device_uuid` |
| **Exploited Asset** | Device UUID |
| **Attack Vector** | XSS extracts device_uuid, attacker registers same UUID on rogue device |
| **Impact** | 4 (High) - Attacker receives messages fan-out meant for victim |
| **Likelihood** | 3 (Moderate) - Requires XSS + backend acceptance of duplicate |
| **Risk Score** | 12 (MEDIUM) |
| **Mitigation** | Device attestation, UUID binding to hardware fingerprint |

### T1-S-02: Token Theft via XSS
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | localStorage `id_token`, `refresh_token` |
| **Exploited Asset** | Firebase/PHP tokens |
| **Attack Vector** | XSS payload reads tokens from localStorage |
| **Impact** | 5 (Critical) - Full account takeover |
| **Likelihood** | 3 (Moderate) - Requires successful XSS injection |
| **Risk Score** | 15 (HIGH) |
| **Mitigation** | HTTP-Only cookies, Token binding, CSP hardening |

### T1-S-03: Session Hijacking via Ratchet State Clone
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | localStorage ratchet session state |
| **Exploited Asset** | Ratchet Root/Chain Keys |
| **Attack Vector** | Attacker clones ratchet state to decrypt future messages |
| **Impact** | 5 (Critical) - Loss of forward secrecy |
| **Likelihood** | 2 (Low) - Requires device access or XSS |
| **Risk Score** | 10 (MEDIUM) |
| **Mitigation** | Hardware-backed key storage, Session binding |

---

## 2. Tampering Threats

### T1-T-01: localStorage Manipulation
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | All localStorage keys |
| **Exploited Asset** | Ratchet state, device config, tokens |
| **Attack Vector** | Malicious browser extension or XSS modifies stored data |
| **Impact** | 4 (High) - Corrupted crypto state, session disruption |
| **Likelihood** | 3 (Moderate) - Common attack pattern |
| **Risk Score** | 12 (MEDIUM) |
| **Mitigation** | HMAC integrity checks on stored data |

### T1-T-02: SQLite Cache Poisoning
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | SQLite database file (mobile/desktop) |
| **Exploited Asset** | Cached decrypted messages |
| **Attack Vector** | Physical device access modifies cached messages |
| **Impact** | 3 (Moderate) - False message history display |
| **Likelihood** | 2 (Low) - Requires physical access |
| **Risk Score** | 6 (LOW) |
| **Mitigation** | Encrypted SQLite, integrity hashes |

### T1-T-03: Backup JSON Tampering
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | Exported backup JSON file |
| **Exploited Asset** | Private key, device config |
| **Attack Vector** | User restores tampered backup with malicious key |
| **Impact** | 5 (Critical) - Identity replacement |
| **Likelihood** | 1 (Rare) - Requires user error |
| **Risk Score** | 5 (LOW) |
| **Mitigation** | Signed backup files, Password encryption |

---

## 3. Repudiation Threats

### T1-R-01: Missing Client-Side Audit Logs
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | All user actions |
| **Exploited Asset** | User accountability |
| **Attack Vector** | User denies sending message, no local evidence |
| **Impact** | 2 (Low) - Compliance/legal risk |
| **Likelihood** | 4 (Likely) - No logging exists |
| **Risk Score** | 8 (MEDIUM) |
| **Mitigation** | Implement client-side audit trail |

### T1-R-02: Key Rotation Without Evidence
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | Key rotation API |
| **Exploited Asset** | Key history |
| **Attack Vector** | User rotates key to deny previous message ownership |
| **Impact** | 3 (Moderate) - Attribution issues |
| **Likelihood** | 3 (Moderate) - Easy to trigger |
| **Risk Score** | 9 (MEDIUM) |
| **Mitigation** | Key transparency log, signed key history |

---

## 4. Information Disclosure Threats

### T1-I-01: Plaintext Backup Exposure (H2)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | BackupService JSON export |
| **Exploited Asset** | Master Private Key |
| **Attack Vector** | Unencrypted backup stored in cloud/email |
| **Impact** | 5 (Critical) - Complete identity compromise |
| **Likelihood** | 4 (Likely) - No password required |
| **Risk Score** | 20 (CRITICAL) |
| **Mitigation** | Mandatory password-encrypted backups |

### T1-I-02: SQLite Plaintext Cache (G1)
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | SQLite database file |
| **Exploited Asset** | Decrypted message history |
| **Attack Vector** | Physical access reads plaintext messages from SQLite |
| **Impact** | 5 (Critical) - Full message history exposure |
| **Likelihood** | 3 (Moderate) - Requires device access |
| **Risk Score** | 15 (HIGH) |
| **Mitigation** | SQLCipher encryption, OS-level FDE |

### T1-I-03: Memory Dump Key Extraction
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | Process memory |
| **Exploited Asset** | Session keys, decrypted content |
| **Attack Vector** | Memory forensics extracts in-memory keys |
| **Impact** | 4 (High) - Session key recovery |
| **Likelihood** | 2 (Low) - Requires advanced attack |
| **Risk Score** | 8 (MEDIUM) |
| **Mitigation** | Zeroization after use, Secure memory allocation |

---

## 5. Denial of Service Threats

### T1-D-01: Firestore Listener Storm
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | Firestore real-time listeners |
| **Exploited Asset** | Client resources |
| **Attack Vector** | Rapid message flood triggers excessive listener callbacks |
| **Impact** | 3 (Moderate) - UI freeze, battery drain |
| **Likelihood** | 3 (Moderate) - Easy to trigger |
| **Risk Score** | 9 (MEDIUM) |
| **Mitigation** | Client-side rate limiting, Debouncing |

### T1-D-02: Ratchet Exhaustion Attack
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | Message receive pipeline |
| **Exploited Asset** | Ratchet chain state |
| **Attack Vector** | Attacker sends thousands of messages to exhaust chain |
| **Impact** | 3 (Moderate) - Session reset required |
| **Likelihood** | 2 (Low) - Requires valid sender identity |
| **Risk Score** | 6 (LOW) |
| **Mitigation** | Chain depth limits, Anti-flood controls |

---

## 6. Elevation of Privilege Threats

### T1-E-01: XSS to Full Token Takeover
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | User input fields, message display |
| **Exploited Asset** | All localStorage tokens and keys |
| **Attack Vector** | XSS extracts tokens → full API access as victim |
| **Impact** | 5 (Critical) - Complete account takeover |
| **Likelihood** | 3 (Moderate) - Requires XSS vulnerability |
| **Risk Score** | 15 (HIGH) |
| **Mitigation** | CSP, Input sanitization, HTTP-Only tokens |

### T1-E-02: CryptoService API Abuse via XSS
| Attribute | Value |
| :--- | :--- |
| **Entry Point** | XSS calling CryptoService methods |
| **Exploited Asset** | Private key operations |
| **Attack Vector** | XSS forces CryptoService to sign/decrypt arbitrary data |
| **Impact** | 5 (Critical) - Key material exposed via API |
| **Likelihood** | 2 (Low) - Requires specific XSS exploitation |
| **Risk Score** | 10 (MEDIUM) |
| **Mitigation** | API rate limiting, Operation confirmation |

---

## 7. Component-Specific Summary

| Component | S | T | R | I | D | E | Top Risk |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **SecureStorageService** | ✓ | ✓ | - | ✓ | - | - | Token theft (T1-S-02) |
| **CryptoService** | ✓ | - | - | ✓ | - | ✓ | API abuse (T1-E-02) |
| **LinkService** | ✓ | - | - | ✓ | - | - | Ephemeral key theft |
| **AuthInterceptor** | ✓ | - | - | ✓ | - | ✓ | Token injection |
| **SQLite Outbox** | - | ✓ | - | ✓ | ✓ | - | Plaintext cache (T1-I-02) |

---

## 8. Risk ID Cross-Reference

| Threat ID | Security Assumptions ID |
| :--- | :--- |
| T1-I-01 | H2 |
| T1-I-02 | G1 |
| T1-S-02 | - (New) |
| T1-E-01 | - (New) |
