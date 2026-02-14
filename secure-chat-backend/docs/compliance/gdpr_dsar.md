# GDPR & DSAR Guide
**Applicability**: General Data Protection Regulation (EU), CCPA (California).

## 1. Data Subject Access Request (DSAR)
Users have the right to request a copy of their data.

### 1.1 Automated Export
**Endpoint**: `GET /api/user/export.php` (Coming Soon - Roadmapped for Phase 17)
- **Current Workaround**: Administrators can generate a JSON export via the Console.

### 1.2 Administrative Export
Admins can trigger an export via the Console:
```bash
php scripts/export_user_data.php --user_id=<UUID>
```
*Output is encrypted with the Admin's PGP key.*

## 2. Right to be Forgotten
Users have the right to delete their account and associated data.

### 2.1 Self-Service Deletion
**Endpoint**: `DELETE /api/delete_account.php`
- **Effect**: Hard deletes User row, wipes Session tokens, and drops encryption keys.
- **Messages**: Message content is cryptographically shredded (keys deleted).

### 2.2 Retention Impact
- **Backups**: Data persists in encrypted cold storage for 30 days (see Data Retention Policy).
- **Logs**: Anonymized access logs are kept for 90 days.
