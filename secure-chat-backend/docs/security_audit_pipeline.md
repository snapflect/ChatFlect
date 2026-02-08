# Security Audit Pipeline (Epic 51)

## Architecture
The audit pipeline centralizes all security-critical events into a tamper-evident log stream.

### 1. Data Source
- **Users Table**: Authentication events.
- **Crypto Engine**: Decryption failures, key rotations.
- **Sync Engine**: Replay attempts, rate limit breaches.

### 2. Storage
- **Table**: `security_audit_log` (Append-Only)
- **Retention**: Critical events retained for 1 year (Compliance). Info events 30 days.

### 3. Events Dictionary
| Event Type | Severity | Description |
| :--- | :--- | :--- |
| `DEVICE_REVOKED` | `WARNING` | User manually revoked a device. |
| `DECRYPT_FAIL` | `CRITICAL` | GCM Tag validation failed (potential tampering). |
| `SYNC_RATE_LIMIT` | `WARNING` | Device exceeded sync quota. |
| `AUTH_FAIL_BRUTE` | `CRITICAL` | Multiple failed logins from IP. |

### 4. Alerting
Polled via `cron/security_alerts.php`.
- **High Alert**: >10 Decrypt Fails / 5 min from single device.
- **Medium Alert**: >20 Rate Limit Hits / 5 min.

## Access Control
- Logs accessible ONLY via `api/v4/security/events.php`
- Protected by `X-Admin-Secret` header (Environment Variable).

## Tamper Detection (Epic 51-HF)
To ensure the integrity of the audit trail (`security_audit_log`), the following measures are recommended:

1.  **Row Integrity**: Use database triggers to prevent `UPDATE` or `DELETE` on the log table (except by the authorized `cleanup_audit_logs.php` user).
2.  **Sequence Gaps**: Monitor `audit_id` auto-increment field. A gap indicates a potential hard deletion.
3.  **Hash Chaining** (Future): Store a hash of the previous row in the current row to form a cryptographic chain.

