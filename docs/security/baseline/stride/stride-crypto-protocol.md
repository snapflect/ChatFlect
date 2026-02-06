# STRIDE Threat Model: Cryptographic Protocol Layer - TASK 1.3-E

> **Version**: 1.0 | **Date**: 2026-02-06 | **Scope**: E2EE Protocol Design Weaknesses

---

## 1. Protocol STRIDE Matrix

| Protocol Component | S | T | R | I | D | E | Top Threat |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| Key Registration | ✓ | ✓ | - | ✓ | - | - | E1 - Key injection |
| Key Distribution | ✓ | ✓ | - | - | - | - | Key substitution |
| Message Encryption (v1) | - | ✓ | - | ✓ | - | - | Ciphertext replay |
| Message Encryption (v2) | - | ✓ | - | ✓ | - | - | Ratchet compromise |
| Backup/Restore | - | ✓ | - | ✓ | - | - | H2 - Plaintext backup |
| Desktop Sync | ✓ | - | - | ✓ | - | - | Ephemeral key theft |

---

## 2. Backend Key Injection (E1) 🚨

| Attribute | Value |
| :--- | :--- |
| **Protocol Weakness** | No client-side verification of public keys |
| **Entry Point** | `keys.php` public key directory |
| **Attack Vector** | Compromised backend replaces victim's public key with attacker's key |
| **User Impact** | All future messages encrypted to attacker; MITM established |
| **Impact** | 5 (Critical) |
| **Likelihood** | 3 (Moderate) - Requires backend compromise |
| **Risk Score** | 15 (HIGH) |
| **Evidence** | [security-assumptions.md#Risk-E1](../security-assumptions.md) |
| **Mitigation Strategy** | 1. Signed key bundles (identity key signs device key) |
|  | 2. Safety Numbers (visual fingerprint for users to verify) |
|  | 3. Key Transparency Log (public audit of key changes) |

---

## 3. Key Substitution Attack

| Attribute | Value |
| :--- | :--- |
| **Protocol Weakness** | Public keys fetched without integrity verification |
| **Entry Point** | Client key discovery from MySQL |
| **Attack Vector** | MITM intercepts key fetch, substitutes attacker key |
| **User Impact** | Same as E1; attacker intercepts communications |
| **Impact** | 5 (Critical) |
| **Likelihood** | 2 (Low) - Requires network MITM + TLS bypass |
| **Risk Score** | 10 (MEDIUM) |
| **Evidence** | [crypto-attack-surface-notes.md](../crypto/crypto-attack-surface-notes.md) |
| **Mitigation Strategy** | 1. Certificate pinning |
|  | 2. Signed key responses from backend |

---

## 4. Ratchet State Compromise

| Attribute | Value |
| :--- | :--- |
| **Protocol Weakness** | Ratchet keys stored in plaintext localStorage |
| **Entry Point** | `localStorage` ratchet session data |
| **Attack Vector** | XSS or device access extracts ratchet root/chain keys |
| **User Impact** | Loss of forward secrecy for active sessions |
| **Impact** | 5 (Critical) |
| **Likelihood** | 2 (Low) - Requires successful XSS |
| **Risk Score** | 10 (MEDIUM) |
| **Evidence** | [crypto-storage-map.md](../crypto/crypto-storage-map.md) |
| **Mitigation Strategy** | 1. Encrypt ratchet state with hardware-backed key |
|  | 2. Session pinning to device attestation |

---

## 5. Downgrade Attack (v2 → v1)

| Attribute | Value |
| :--- | :--- |
| **Protocol Weakness** | Client accepts both v1 (one-time AES) and v2 (ratchet) |
| **Entry Point** | Message envelope `cipherVersion` field |
| **Attack Vector** | Attacker forces conversation to v1, losing forward secrecy |
| **User Impact** | Single session key compromise exposes all messages |
| **Impact** | 4 (High) |
| **Likelihood** | 2 (Low) - Requires MITM + version manipulation |
| **Risk Score** | 8 (MEDIUM) |
| **Evidence** | [crypto-envelope-spec.md](../crypto/crypto-envelope-spec.md) |
| **Mitigation Strategy** | 1. Minimum version enforcement |
|  | 2. Version negotiation handshake |
|  | 3. Alert user on version downgrade |

---

## 6. Replay of Ciphertext Envelopes

| Attribute | Value |
| :--- | :--- |
| **Protocol Weakness** | No replay protection on message envelopes |
| **Entry Point** | Firestore message documents |
| **Attack Vector** | Attacker replays old ciphertext, confusing message order |
| **User Impact** | Message duplication, confusion |
| **Impact** | 2 (Low) |
| **Likelihood** | 3 (Moderate) - Write access to Firestore needed |
| **Risk Score** | 6 (LOW) |
| **Evidence** | [crypto-envelope-spec.md](../crypto/crypto-envelope-spec.md) |
| **Mitigation Strategy** | 1. Message sequence numbers with gap detection |
|  | 2. HMAC over entire envelope |

---

## 7. Missing Signature on Key Bundles

| Attribute | Value |
| :--- | :--- |
| **Protocol Weakness** | Public keys not signed by identity key |
| **Entry Point** | Key registration / distribution |
| **Attack Vector** | Backend or MITM injects unsigned rogue key |
| **User Impact** | Foundation for E1 attack |
| **Impact** | 5 (Critical) |
| **Likelihood** | 3 (Moderate) |
| **Risk Score** | 15 (HIGH) |
| **Evidence** | [crypto-attack-surface-notes.md](../crypto/crypto-attack-surface-notes.md) |
| **Mitigation Strategy** | 1. Device key signed by Identity Key |
|  | 2. Signature verification on key fetch |

---

## 8. Missing Key Transparency Log

| Attribute | Value |
| :--- | :--- |
| **Protocol Weakness** | No public log of key changes |
| **Entry Point** | Key rotation / registration |
| **Attack Vector** | Silent key replacement undetected |
| **User Impact** | Users cannot audit their own key history |
| **Impact** | 4 (High) |
| **Likelihood** | 3 (Moderate) |
| **Risk Score** | 12 (MEDIUM) |
| **Evidence** | [key-lifecycle-matrix.md](../crypto/key-lifecycle-matrix.md) |
| **Mitigation Strategy** | 1. Append-only key log (blockchain or CT-like) |
|  | 2. Client-side key change notifications |

---

## 9. Risk Summary

| Threat ID | Threat | Risk Score | Priority |
| :---: | :--- | :---: | :---: |
| **E1** | Backend Key Injection | 15 | HIGH |
| **CP-02** | Key Substitution Attack | 10 | MEDIUM |
| **CP-03** | Ratchet State Compromise | 10 | MEDIUM |
| **CP-04** | Downgrade Attack | 8 | MEDIUM |
| **CP-05** | Ciphertext Replay | 6 | LOW |
| **CP-06** | Missing Key Signatures | 15 | HIGH |
| **CP-07** | Missing Key Transparency | 12 | MEDIUM |

---

## 10. Evidence Cross-Reference

| Document | Relevant Threats |
| :--- | :--- |
| [crypto-envelope-spec.md](../crypto/crypto-envelope-spec.md) | CP-04, CP-05 |
| [crypto-assets-inventory.md](../crypto/crypto-assets-inventory.md) | All |
| [crypto-attack-surface-notes.md](../crypto/crypto-attack-surface-notes.md) | E1, CP-02, CP-06 |
| [key-lifecycle-matrix.md](../crypto/key-lifecycle-matrix.md) | CP-07 |
