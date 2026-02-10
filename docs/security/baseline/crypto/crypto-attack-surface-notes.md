# Crypto Attack Surface Notes (TASK 1.2-G) - ChatFlect

This document identifies the specific crypto-relevant attack vectors targeting the ChatFlect system, satisfying P0 requirements.

## 1. Attack Surface Table (P0)

| ID | Threat Name | Exploited Asset | Exploit Mechanism | Affected Flows | Mitigation Reference |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **E1** | Backend Key Injection | RSA Public Key (MySQL) | Compromised backend replaces user's public key with attacker's key | Key Discovery, Message Fan-out | Signed Key Bundles (Phase 2) |
| **J4** | Unauthenticated Device Registration | Device Key Registry | `devices.php` lacks authentication; rogue key registered for any `user_id` | Device Provisioning, E2EE Distribution | Add JWT Auth to `devices.php` |
| **H2** | JSON Backup Leakage | Master Private Key (JSON) | Unencrypted backup file stored insecurely by user | Backup/Restore, Identity | Password-Encrypted Backups (Phase 2) |
| **I1** | Chat Metadata Leakage | Firestore Chat Docs | `lastMessage`, `typing`, `unread` counters are plaintext | Chat UI, Presence | Encrypted Metadata Fields (Phase 2) |
| **I2** | Fan-out Key Map Side Channel | `keys` Map (Message Docs) | Device count per user visible to server; traffic analysis | Message Send, Multi-Device | Padding/Obfuscation (Phase 2) |
| **G1** | SQLite Plaintext Caching | Decrypted Messages (SQLite) | `StorageService` caches plaintext for offline search | Message Receive, Search | Encrypted SQLite (Phase 2) |
| **D2** | Web Fingerprint Entropy Risk | PBKDF2 Key Derivation | Low-entropy browser fingerprint weakens storage wrap | Web Fallback Auth | Per-Device Random Salt (Phase 2) |

---

## 2. Trust Boundaries Analysis

### Boundary T1: Client Application
- **Trust Level**: High (Sovereign).
- **Assumed Control**: Secure RNG, Secure Key Storage (Mobile), Frame Isolation (XSS Protection).
- **Violation Risk**: XSS breach forces `CryptoService` to export keys.

### Boundary T2: Backend Control Plane
- **Trust Level**: Semi-Trusted (Signaling Only).
- **Assumed Control**: Auth Token verification, Rate limiting.
- **Violation Risk**: Key injection (E1) enables MITM, but cannot decrypt history.

### Boundary T3: External Infrastructure (Firestore)
- **Trust Level**: Untrusted (Storage Only).
- **Assumed Control**: Persistence.
- **Violation Risk**: Sees conversation graphs (metadata, I1/I2), blind to E2EE content.

---

## 3. HIGH Risk Cross-Reference

The following HIGH-severity risks are documented in [security-assumptions.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/security-assumptions.md):

| ID | Risk | Reference |
| :---: | :--- | :--- |
| **E1** | Backend Key Injection Attack | `security-assumptions.md#Risk-E1` |
| **H2** | Unencrypted Backup Security | `security-assumptions.md#Risk-H2` |

---

## 4. Mitigation Strategies (Phase 2 Roadmap)

1.  **Signed Key Bundles**: Client signs Public Key with Identity Key (Mitigates E1).
2.  **Encrypted Backups**: User password for PBKDF2 derivation (Mitigates H2).
3.  **HTTP-Only Cookies**: Move session tokens from `localStorage` (XSS mitigation).
4.  **Hardware-Backed Storage**: Force Keychain/Keystore for all crypto material.
5.  **Authenticated Endpoints**: Add JWT validation to `devices.php` (Mitigates J4).
