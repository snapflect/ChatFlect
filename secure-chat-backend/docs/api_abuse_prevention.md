# API Abuse Prevention Policy (Epic 52)

## Global Limits
| Endpoint Group | Limit (Token Bucket) | Burst | Scope |
| :--- | :--- | :--- | :--- |
| **Auth/Register** | 10 req / min | 5 | Per IP |
| **Message Pull** | 60 req / min | 10 | Per Device |
| **Sync Repair** | 10 req / min | 2 | Per Device |
| **General API** | 100 req / min | 20 | Per IP |

## Ban Policy
- **Temporary Ban**: 1 Hour (Automatic after 5x rate limit breaches)
- **Permanent Ban**: Admin Discretion (via `api/v4/security/ban.php`)

## Architecture
- **State**: `rate_limit_buckets` table (MySQL)
- **Enforcer**: `includes/abuse_guard.php` (Middleware)
- **Monitoring**: Violations log `RATE_LIMIT_HIT` to Audit Log.
