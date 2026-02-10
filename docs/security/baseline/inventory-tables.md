# System Inventory Tables - ChatFlect

This document provides a detailed inventory of API endpoints and client-side modules.

## 1. Backend API Inventory (PHP)

| Endpoint | Method | Action / Purpose | Auth Required |
| :--- | :--- | :--- | :--- |
| `register.php` | POST | Initial signup, OTP request. | No |
| `profile.php` | POST | OTP confirmation, profile updates, key sync. | Partial |
| `firebase_auth.php` | POST | Exchange PHP session for Firebase token. | Yes |
| `devices.php` | POST | Register/unregister device & public keys. | Yes |
| `keys.php` | GET | Retrieve user/device public keys. | Yes |
| `groups.php` | POST | Create/manage group metadata & members. | Yes |
| `contacts.php` | GET/POST | Search users, sync contact lists. | Yes |
| `refresh_token.php` | POST | Rotate authentication tokens. | No (uses refresh token) |
| `upload.php` | POST | Upload encrypted media blobs. | Yes |
| `push.php` | POST | Trigger outgoing push notifications. | Yes |
| `calls.php` | POST | Call signaling metadata management. | Yes |
| `oauth.php` | POST | Google OAuth authentication handler. | No |
| `audit_log.php` | POST | Log client-side errors and security events. | Yes |
| `serve.php` | GET | Securely serve media content to authorized users. | Yes |
| `status.php` | GET | Check system & database health. | No |

---

## 2. Client Module Inventory (Angular/TypeScript)

| Service Module | Purpose | Core Responsibilities |
| :--- | :--- | :--- |
| **AuthService** | Session Management | Token lifecycle, logout, device registration. |
| **ChatService** | Message Management | E2EE distribution, Firestore listeners, outbox. |
| **CryptoService** | Cryptography | Low-level WebCrypto wrappers, Ratchet state. |
| **ApiService** | Networking | Standardized HTTP requests & interceptors. |
| **PushService** | Notifications | FCM token management, background task logic. |
| **PresenceService** | Real-time Status | Typing indicators, online/offline heartbeats. |
| **SecureMediaService** | Media Handling | Blob encryption/decryption, caching logic. |
| **StorageService** | Persistence | SQLite management, outbox storage, message cache. |
| **CallService** | WebRTC Signaling | Peer connection lifecycle, signaling via API. |
| **SyncService** | Data Integrity | Offline reconciliation, history synchronization. |
| **ContactService** | Social Discovery | Contact list syncing, user search logic. |
| **LoggingService** | Observability | Console logging & remote audit log dispatch. |
| **GlobalErrorHandler** | Resilience | Catching unhandled exceptions for audit logs. |

---

## 3. Internal Helper Modules

- **SimpleJWT.php**: Backend utility for generating/validating local JWTs.
- **auth_middleware.php**: PHP filter for enforcing token validation on API endpoints.
- **email_service.php**: Backend SMTP/Mail handler for OTP delivery.
- **sanitizer.php**: Security utility for cleaning inputs on the backend.
- **cache_service.php**: (Potential) Redis/File cache for performance.
