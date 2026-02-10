# Compliance & Governance Contract (Epic 54)

## Retention Policies
| Data Type | Retention Period (Default) | Config Key |
| :--- | :--- | :--- |
| Audit Logs | 365 Days | `retention_audit_logs_days` |
| Messages | 30 Days | `retention_messages_days` |
| Abuse Scores | 90 Days | `retention_abuse_scores_days` |

## Legal Hold
- **Effect**: Overrides all retention policies. Data MUST NOT be deleted.
- **Scope**: User, Device, or Conversation.
- **Management**: via `api/v4/security/legal_hold.php` (Admin only).

## Deletion (GDPR/CCPA)
- **Workflow**: `gdpr_delete.php`
- **Behavior**: Wipes user PII, anonymizes logs.
- **Safety**: Fails 409 Conflict if Legal Hold is active.
