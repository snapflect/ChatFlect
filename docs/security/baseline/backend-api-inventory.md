# Backend API Inventory (TASK 1.1-J) - ChatFlect

This document catalogs all backend PHP endpoints, their authentication state, and operational security attributes.

## 1. Authentication & Identity Layer

| Endpoint Path | Method | Auth | Device Binding | Input Validation | Output Sensitivity | Failure Modes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/register.php` | POST | N | N | Email/Phone regex | Low (OTP Sent) | 429 (Rate Limit) |
| `/api/profile.php` | POST | Y* | N | Action-based | **High** (JWTs) | 400 (Invalid OTP) |
| `/api/profile.php` | GET | **N** | N | `user_id` | **High** (Email/Phone)| 404 (Not Found) |
| `/api/firebase_auth.php`| POST | Y | N | None | **High** (Custom Token)| 401 (Unauthorized) |
| `/api/refresh_token.php`| POST | N* | Y | Refresh Token | **High** (New JWTs) | 401 (Invalid Token)|

> [!CAUTION]
> **Risk J7**: Profile `GET` is currently unauthenticated, exposing user contact info (email/phone) to any requester with a `user_id`.

## 2. E2EE & Device Management

| Endpoint Path | Method | Auth | Device Binding | Input Validation | Output Sensitivity | Failure Modes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/keys.php` | GET | **N** | N | `user_id`/`phone` | **Medium** (PubKeys) | 404 (Not Found) |
| `/api/devices.php` | POST | **N** | N | `user_id`, UUID | **Medium** (Metadata) | 400 (Missing Fields)|
| `/api/devices.php` | GET | **N** | N | `user_id` | **Medium** (UUID list) | 404 (Not Found) |
| `/api/devices.php` | DELETE | **N** | N | `user_id`, UUID | **Medium** (Revocation)| 500 (DB Error) |

> [!WARNING]
> **Risk J4**: `devices.php` lacks authentication. An attacker can register a rogue device to any `user_id` or revoke a legitimate user's device if they know the `user_id`.

## 3. Social & Messaging Support

| Endpoint Path | Method | Auth | Device Binding | Input Validation | Output Sensitivity | Failure Modes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/contacts.php` | POST | **N** | N | Search Query / Phones| **High** (User Profiles)| 405 (Method) |
| `/api/groups.php` | POST | Y/N*| N | Action-based | **Medium** (Metadata) | 403 (Forbidden) |
| `/api/status.php` | POST | **N***| N | JSON Payload | **Medium** (Activity) | 400 (Missing ID) |
| `/api/calls.php` | POST | Y | N | Action-based | **Medium** (Metadata) | 403 (Forbidden) |

> [!CAUTION]
> **Risk J8**: `contacts.php` search is public, allowing mass harvesting of user profiles via wildcard queries.
> **Risk J9**: `status.php` only validates presence of `user_id`, not ownership. Anyone can post/delete status updates as any user.

## 4. Media & File Handling

| Endpoint Path | Method | Auth | Device Binding | Input Validation | Output Sensitivity | Failure Modes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/upload.php` | POST | **N** | N | MIME Allowlist | **Medium** (File URLs) | 400 (Unsupported) |
| `/api/serve.php` | GET | **N** | N | Realpath / Traversal | **High** (User Data) | 403 (Access Denied)|

---

## 5. Summary of Trust Assumptions

1.  **Implicit Authenticity**: The backend assumes that if a `user_id` is provided in unauthenticated endpoints (like `status.php` or `devices.php`), it is legitimate. This is a primary target for Phase 2 hardening.
2.  **Public Key Discovery**: Public keys are considered non-sensitive transit data, hence `keys.php` is public to facilitate E2EE discovery.
3.  **Media Proxying**: `serve.php` is intentionally public to support `<img>` tags and the "Burn-on-Read" (v16) logic without complex header management.
