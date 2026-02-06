# Token Inventory (TASK 1.2-B) - ChatFlect

This document catalogs all authentication and identity tokens used in the ChatFlect system, satisfying the P0 requirements for STORY-1.2.

## 1. Token Inventory Table

| Token Name | Issuer | Verification Mechanism | Storage Location | TTL | Rotation Rules | Threat Exposure Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PHP ID Token** | ChatFlect API | Session Lookup (MySQL/Cache) | `localStorage` | 1 Hour | Renewed via Refresh Token | Accessible to XSS. Session hijacking if leaked. |
| **PHP Refresh Token**| ChatFlect API | Database Match (SHA-256) | `localStorage` | Persistent | Rotated on every use (v8.1) | Accessible to XSS. Rotation limits replay risk. |
| **Firebase Custom** | ChatFlect Hub | RS256 (Service Account) | Memory | 5-60 Mins| One-time Exchange | Short-lived; only used for handshaking. |
| **Firebase ID** | Google Auth | RSA (Google Public Keys) | Firebase SDK | 1 Hour | SDK Managed Rotation | Hard to extract but vulnerable to proxying. |
| **FCM Token** | Google Cloud | Push Ticket Match | MySQL (`users`) | Persistent | OS/SDK Managed | Leakage leads to spam or ghost notifications. |

---

## 2. Technical Specifications

### PHP `id_token` (Session ID)
- **Format**: 'U' prefixed 24-char Hex string (e.g., `U6B20...`).
- **Generation**: `bin2hex(random_bytes(12))` in `refresh_token.php` and `register.php`.
- **Validation**: `auth_middleware.php` checks the `Authorization: Bearer` header against the `user_sessions` table (or Cache).

### PHP `refresh_token`
- **Format**: 64-char Hex string.
- **Security Mechanic**: Implements **Refresh Token Rotation**. When the client calls `refresh_token.php`, the old token is invalidated and a brand new one is issued (returning it in the `refresh_token` field of the response).

### Firebase Custom Token
- **Format**: RS256 JWT.
- **Claims**: Includes `sub` (Normalized User ID) and custom claims like `is_verified`.
- **Secret**: Signed using the project's **Service Account Private Key** (`SimpleJWT::createCustomToken`).

### FCM Token (Push Credentials)
- **Flow**: Client receives token from Firebase SDK -> Sends to `profile.php?action=update_fcm` -> Stored in MySQL.
- **Usage**: Backend `push.php` uses this token to route encrypted message alerts to specific devices.

---

## 3. Session Cookie Audit
- **Status**: **Stateless**.
- **Finding**: A recursive `grep` for `session_start()` returned zero results. The system does not use `PHPSESSID` or server-side cookies, relying entirely on the `Authorization` header.

---

## 4. Compliance Verification

- [x] Every token name matches the `auth-flow.md` sequence diagrams.
- [x] Storage locations confirmed via `AuthService.ts` audit.
- [x] Verification mechanisms (Database vs JTI vs JWT) explicitly defined.
- [x] No orphaned tokens exist without documentation.

> [!IMPORTANT]
> **Risk E2 — Token Persistence**: Currently, tokens are stored in `localStorage` in plaintext. This makes the system highly susceptible to account takeover via XSS. Phase 2 should explore `HttpOnly` cookies for `id_token` delivery.
