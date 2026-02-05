# Consolidated Architecture Baseline Report (STORY-1.1)

This report serves as the definitive technical baseline for the ChatFlect system architecture. It consolidates all research, mapping, and risk identification conducted during STORY-1.1 to establish a defensible starting point for Phase 2 security hardening.

---

## 1. System Components & Trust Model

The ChatFlect ecosystem consists of a hybrid architecture leveraging client-side E2EE, a PHP-based control plane, and Firestore for real-time data persistence.

- **Component Inventory**: [components-inventory.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/components-inventory.md)
- **High-Level Design**: 
    ![Architecture Overview](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/architecture-high-level.png)

### Trust Boundaries
- **Zero-Trust (Client)**: The client performs all cryptographic operations (RSA-OAEP, AES-GCM). The Master Private Key never leaves the local device storage.
- **Semi-Trusted (Backend)**: The PHP API manages identity (OTP), device registration, and signaling. It is not trusted with message content.
- **Untrusted (Infrastructure)**: Firebase Firestore is treated as a blind storage layer for encrypted blobs and metadata.

---

## 2. Core Operational Flows

The system's logic is defined by four foundational pipelines:

| Flow Name | Description | Reference |
| :--- | :--- | :--- |
| **Authentication** | Firebase Identity lifecycle and JWT rotation. | [auth-flow.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/auth-flow.md) |
| **Key Registration**| RSA Key generation and public key publication. | [key-registration-flow.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/key-registration-flow.md) |
| **Messaging** | Multi-device fan-out encryption and delivery. | [message-send-flow.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/message-send-flow.md) |
| **Device Sync** | Session mirroring via ephemeral QR handshakes. | [multi-device-sync-flow.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/multi-device-sync-flow.md) |

---

## 3. Data Persistence & Security Controls

Technical specifications for the system's control planes:

- **Firestore Schema Map**: [firestore-schema-map.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/firestore-schema-map.md)
    - Defines field-level ownership and real-time listener behavior.
- **Backend API Inventory**: [backend-api-inventory.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/backend-api-inventory.md)
    - Catalogs all 15+ PHP endpoints and identifies authentication gaps.

---

## 4. Consolidated Risk Register (Base Baseline)

A summary of all identified risks categorized by their architectural impact:

### High Priority (Phase 2 Mandatory Fixes)
- **Risk E1 — Backend Key Injection**: Potential for the PHP API to inject rogue public keys during device discovery.
- **Risk H2 — Unencrypted Backup Security**: Local backups contain the Master Private Key in plaintext/JSON.
- **Risk J4 — Unauthenticated Device Registration**: Rogue devices can be registered to any `user_id` without a session.
- **Risk J9 — Identity Spoofing**: Lack of ownership verification in the Status and Groups API.

### Medium/Low Priority (Monitoring/Hardening)
- **Risk I1 — Metadata Leakage**: Activity patterns visible via unencrypted Firestore fields.
- **Risk J8 — Contact Harvesting**: Public search wildcards allow directory scraping.

> Full Risk Details: [security-assumptions.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/security-assumptions.md)

---

## 5. Known Failure Points & Resilience

1.  **Historical Gap**: New devices added to an existing account cannot decrypt historical messages (No Key availability).
2.  **Handshake Phishing**: Ephemeral QR sync can be exploited if the user is socially engineered into scanning a rogue code.
3.  **Audit Gaps**: Real-time message deletion in Firestore removes evidence of compromise before it can be audited.

---

## 6. Conclusion
ChatFlect possesses a strong cryptographic foundation but suffers from significant architectural gaps in the semi-trusted PHP layer. Phase 2 must focus on **Identity-to-Key binding** and **Backend Access Control** to maintain the integrity of the E2EE trust model.

---

## 7. Crypto Assets & Secrets (STORY-1.2)

A formal inventory of the system's cryptographic primitives and assets:

### Cryptographic Assets
- **Asset Inventory**: [crypto-assets-inventory.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/crypto-assets-inventory.md)
    - Lists RSA-2048 identity keys, AES-256 session keys, and HMAC-256 integrity keys.
- **Storage Map**: [crypto-storage-map.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/crypto-storage-map.md)
    - Maps assets to Keychain/Keystore and encrypted `localStorage` fallbacks.
- **Key Lifecycle**: [key-lifecycle-matrix.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/key-lifecycle-matrix.md)
    - Defines generation, rotation, and revocation triggers.

### Protocols & Schemas
- **Envelope Spec**: [crypto-envelope-spec.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/crypto-envelope-spec.md)
    - Details the `v1` (Hybrid) and `v2` (Ratchet) JSON delivery formats.
- **Algorithm Register**: [crypto-algorithm-register.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/crypto-algorithm-register.md)
    - Confirms usage of SHA-256 for hashes, AES-GCM for symmetric, and RSA-OAEP for asymmetric operations.

### Attack Surface Review
- **Crypto Attack Surface**: [crypto-attack-surface-notes.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/crypto-attack-surface-notes.md)
    - Identifies Backup Exposure (Risk H2) and Key Injection (Risk E1) as primary crypto failure vectors.
- **Token Inventory**: [token-inventory.md](file:///d:/Mubarak/SnapFlectMobileWebApp/ChatFlect/ChatFlect/docs/security/baseline/token-inventory.md)
    - Catalogs PHP JWTs and Firebase ID tokens.
