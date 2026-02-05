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

---
> [!WARNING]
> If any of these assumptions or risks are ignored, the E2EE guarantees of the system may be bypassed. Reduction of these risks is a primary goal for Phase 2.
