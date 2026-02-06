# Crypto Inventory Index (STORY-1.2) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-06 | **Status**: P0 Complete

This index consolidates all cryptographic inventory documents for the ChatFlect E2EE architecture.

## 1. Crypto Documents

| Document | Description |
| :--- | :--- |
| [Crypto Assets Inventory](crypto-assets-inventory.md) | Catalog of Identity, Device, Session, Handshake, and Storage keys. |
| [Crypto Storage Map](crypto-storage-map.md) | Matrix mapping assets to physical storage with risk ratings. |
| [Crypto Envelope Spec](crypto-envelope-spec.md) | JSON schemas for v1/v2/v16 message envelopes. |
| [Token Inventory](token-inventory.md) | Catalog of PHP JWTs, Refresh Tokens, Firebase tokens. |
| [Key Lifecycle Matrix](key-lifecycle-matrix.md) | Lifecycle stages including creation, rotation, destruction. |
| [Crypto Algorithm Register](crypto-algorithm-register.md) | Definitive list of primitives (RSA-OAEP, AES-GCM, PBKDF2). |
| [Crypto Attack Surface Notes](crypto-attack-surface-notes.md) | Threat entry points and mitigation strategies. |

---

## 2. Related Flow Documents

These documents define the operational flows that consume the crypto inventory:

| Flow | Crypto Relevance |
| :--- | :--- |
| [Auth Flow](../auth-flow.md) | Firebase Token issuance, PHP JWT handling. |
| [Device Provisioning Flow](../device-provisioning-flow.md) | Device Key generation and registration. |
| [Key Registration Flow](../key-registration-flow.md) | RSA key pair creation and backend publication. |
| [Message Send Flow](../message-send-flow.md) | AES session key generation, fan-out encryption. |
| [Multi-Device Sync Flow](../multi-device-sync-flow.md) | Ephemeral sync keys, desktop pairing. |

---

## 3. Security Cross-References

- **HIGH Risks**: See [Security Assumptions](../security-assumptions.md) for E1 (Key Injection) and H2 (Backup Leakage).
- **Architecture Report**: See [Architecture Baseline Report](../architecture-baseline-report.md#7-crypto-assets--secrets-story-12).
