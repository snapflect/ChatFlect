# Security Assumptions List - ChatFlect

This document lists the core security assumptions that underpin ChatFlect's current architecture. Identifying these is a prerequisite for a thorough risk assessment and future cryptographic hardening.

## 1. Cryptographic Assumptions

1.  **Unique Device Keys**: We assume each device generates a unique RSA-2048 key pair and that the private key never leaves that device's `SecureStorage` or `LocalStorage`.
2.  **AES-GCM Authenticity**: We assume that `AES-256-GCM` provides sufficient confidentiality and integrity for the message payload, provided the IV is never reused for the same key.
3.  **Key Delivery Integrity**: We assume the Backend API delivers the correct Public Keys for recipients. We current have no client-side mechanism (like Key Transparency or SAS/QR-code verification) to detect a "Man-in-the-Middle" backend that swaps public keys.
4.  **Forward Secrecy (Limited)**: Our Symmetric Ratchet (v2) provides a level of forward secrecy, but we assume the initial session bootstrap (X3DH-Lite) is secure against current threats.

## 2. Infrastructure & Platform Assumptions

1.  **TLS Termination**: We assume all traffic between the client and Backend/Firebase is protected by TLS 1.2+, and that the client validates server certificates correctly.
2.  **Firebase Security Rules**: We assume that Firestore security rules are the primary boundary preventing User A from reading User B's private messages if they are not both in the same `participants` list.
3.  **Firebase Custom Token Integrity**: We assume the `firebase_auth.php` script correctly validates the user's PHP session before issuing a Firebase token, and that the Firebase Private Key on the server is adequately protected.
4.  **Push Notification Privacy**: We assume that push notification payloads do not contain sensitive plaintext, as they pass through third-party servers (Google/Apple). (Current state: payloads contain generic snippets like "🔒 Message").

## 3. Client-Side Assumptions

1.  **Runtime Integrity**: We assume the Android/iOS operating system enforces process isolation, preventing other apps from accessing ChatFlect's memory or local storage.
2.  **Entropies**: We assume the `window.crypto.getRandomValues()` API provides high-entropy random numbers for key and IV generation.
3.  **User Identity**: We assume that the possession of an Email OTP or a Google OAuth token is sufficient proof of identity for the `user_id` claimed.

## 4. Operational Assumptions

1.  **MySQL Consistency**: We assume that the user's `primaryKey` and `deviceKeys` stored in MySQL are the "Source of Truth" for E2EE distribution.
2.  **Audit Log Accuracy**: We assume that logs sent to `audit_log.php` are not being tampered with by a malicious user before dispatch (currently untrusted).

---

## 5. Identified Risks (Phase 1 Baseline)

The following risks have been identified during the Phase 1 mapping and must be addressed in subsequent threat modeling and hardening:

- **Risk R1 — Refresh Token Rotation Security**: While rotation exists in `refresh_token.php`, we must confirm that invalidation of the old token is atomic and that any attempt to reuse an old refresh token triggers an immediate lockout of all sessions for that user (Reuse Detection).
- **Risk R2 — Public Key Registration at OTP Confirmation**: Currently, the `profile.php?action=confirm_otp` endpoint accepts a `public_key` alongside the OTP. If an attacker intercepts the OTP, they can register their own key, effectively hijacking the user's identity for all subsequent encrypted messages.
- **Risk R3 — Custom Token Issuance Scope**: The `firebase_auth.php` bridge generates a custom token bound to a UID. We must verify that this issuance is strictly bound to the authenticated PHP session and, where possible, tied to a specific `device_uuid` to prevent token lateral movement.
- **Risk D1 — device_uuid stored in localStorage**: While non-sensitive, the `device_uuid` is stored in plaintext `localStorage`. If stolen, an attacker could attempt to impersonate a specific device identity at the API level. Backend enforcement of session-to-device binding must be strictly audited.
- **Risk D2 — Web Fallback Key Derivation**: The `SecureStorageService` web fallback uses a "device fingerprint derived key". The entropy and robustness of this fingerprint must be audited to ensure it doesn't degrade into "security theater."
- **Risk D3 — Multi-Device Eviction Transparency**: LRU eviction in `devices.php` forcibly logs out the oldest device. However, there is currently no real-time notification to the user's *other* devices, trust banners in chats, or user-visible audit entries explaining the eviction.
- **🚨 Risk E1 — Backend Key Injection Attack (HIGH)**: The system assumes the PHP backend (`keys.php`) is honest. A compromised server or malicious admin could replace a user's public key with an attacker's key during the discovery fetch. Since there is currently no client-side verification (Safety Numbers) or signed key bundles, this represents the single largest trust weakness in the E2EE architecture.
- **Risk F1 — Key Discovery Latency (UX/Perf)**: In large group chats (20+ participants), the client must perform a separate RSA-OAEP encryption for every device of every participant. This can cause significant processing latency on low-end hardware and increased payload size, potentially leading to a degraded "Sending..." experience or timing-based side-channel leaks.
- **Risk F2 — Metadata Exposure**: While message contents are E2EE, metadata such as `senderId`, `timestamp`, and the `keys` map (showing who is communicating with whom and how many devices they have) is visible to the server and Firestore. This allows for traffic analysis and social graph metadata harvesting.
- **Risk F3 — Order Integrity (No Chaining)**: The Phase 1 implementation uses independent session keys per message without cryptographic chaining (e.g., Double Ratchet). If a session key is compromised, it only affects one message, but the system relies on simple sequence/timestamps for ordering, which can be manipulated by a malicious server.
- **Risk G1 — Local Message Cache Risk**: Decrypted messages are cached in `StorageService` (SQLite). While this enables offline search and performance, it stores plaintext material on the device filesystem. This is a security vs. UX tradeoff that must be audited for disk-level encryption.
- **Risk G2 — User Confusion (KEY_MISSING)**: If a user logs in on a new device, they cannot decrypt past messages because those messages weren't encrypted for the new device's RSA key. Without clear UI education, this looks like a system failure.
- **Risk G3 — Permanent Data Loss (E2EE Behavior)**: If a user wipes their device secure storage (Keychain/Keystore) without a backup, all historical and future messages encrypted for that device are permanently lost. There is no server-side recovery "backdoor."
- **Risk H1 — Sync Request TTL**: Sync requests (session mirroring) in Firestore could linger if the client-side cleanup fails. This leaves a "ghost" encrypted key payload in the cloud which, if compromised along with the ephemeral browser key, could lead to private key exposure.
- **🚨 Risk H2 — Unencrypted Backup Security (HIGH)**: The `BackupService` generates an unencrypted JSON file containing the user's Master Private Key. If a user stores this file insecurely (e.g., in a public cloud, email), the entire E2EE security of their account is compromised.
- **Risk H3 — Handshake Phishing**: A malicious actor could trick a user into scanning a rogue QR code from a phishing site, potentially initiating an unauthorized session mirroring request.

---
> [!WARNING]
> If any of these assumptions or risks are ignored, the E2EE guarantees of the system may be bypassed. Reduction of these risks is a primary goal for Phase 2.
