# Token Inventory (TASK 1.2-D) - ChatFlect

This document catalogs all non-E2EE tokens and secrets used for identity verification and backend session management.

## 1. Primary Authentication Tokens

| Token Name | Source | Format | Purpose | Lifetime | Storage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PHP ID Token** | PHP Backend | JWT (Custom) | Authenticating API requests | ~1 Hour | localStorage |
| **Refresh Token** | PHP Backend | 64-char Hex | Rotating ID tokens | Persistent | localStorage |
| **Firebase ID Token**| Firebase Auth| JWT (Google) | Auth Firestore listeners | ~1 Hour | Memory (Firebase SDK) |

---

## 2. Infrastructure & Exchange Tokens

| Token Name | Source | Format | Purpose | Lifetime | Storage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Custom Token** | `firebase_auth.php`| JWT (Signed) | Exchanging PHP sess -> Firebase | < 5 Mins | Memory (Transit) |
| **Google ID Token**| Google OAuth | JWT | Verifying external identity | ~1 Hour | Memory (Transit) |
| **FCM Token** | Firebase Cloud | String | Addressing push notifications | Persistent | MySQL (`users.fcm_token`) |

---

## 3. JWT Structural Specification (PHP)

The PHP `id_token` is a custom JWT implementation located in `SimpleJWT.php`.

### Payload Claims
- `sub`: User ID (Normalized).
- `jti`: Session ID (Random 'U' prefixed string).
- `iat`: Issued At (Timestamp).
- `exp`: Expiry (Issued At + 1 Hour).
- `uid`: User ID (Redundant for client parsing).

### Signature
- **Algorithm**: HS256 (HMAC-SHA256).
- **Secret**: Hardcoded in `SimpleJWT.php` (Risk: Source exposure).

---

## 4. Token Security Lifecycle

1.  **Issuance**: Triggered by successful OTP verification or OAuth exchange.
2.  **Renewal**: `refresh_token.php` implements **Rotation** (v8.1); every refresh generates a new Refresh Token, invalidating the old one.
3.  **Invalidation**: 
    - **Logout**: Client deletes tokens from `localStorage`.
    - **Revocation**: Server deletes the session record from `user_sessions`.
4.  **Backend Verification**: `auth_middleware.php` verifies the `Authorization: Bearer` header against the `user_sessions` table in MySQL.

---

## 5. Identified Token Risks (Phase 2)

1.  **Hardcoded JWT Secret**: The secret used to sign PHP tokens is defined in the source code, making it vulnerable if the server is compromised.
2.  **Plaintext Storage**: All tokens in `localStorage` are accessible to any script with XSS capability.
3.  **Firebase/PHP Desync**: There is no automatic revocation of the Firebase ID token if the PHP session is terminated early, potentially allowing stale Firestore access.
