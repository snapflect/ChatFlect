# Data Retention Policy

## 1. Core Data
| Data Type | Retention Period | Deletion Method |
| :--- | :--- | :--- |
| **User Profile** | Indefinite (until deletion) | Hard SQL Delete |
| **Messages (Delivered)** | 0 Days (Ephemeral) | Deleted from Server immediately |
| **Messages (Undelivered)**| 30 Days (TTL) | Cron Job `scripts/cleanup_messages.php` |
| **Media Files** | 30 Days | Linked to Message TTL |
| **Auth Tokens** | 180 Days (Rolling) | Expired via `scripts/cleanup_sessions.php` |

## 2. Operational Data
| Data Type | Retention Period | Purpose |
| :--- | :--- | :--- |
| **Access Logs** | 90 Days | Security Auditing |
| **Error Logs** | 14 Days | Debugging |
| **Audit Trail** | 1 Year | Compliance (SOC 2) |

## 3. Backups
- **Frequency**: Daily Incremental, Weekly Full.
- **Retention**: 30 Days.
- **Encryption**: AES-256 (At Rest).
