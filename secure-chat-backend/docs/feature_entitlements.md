# Feature Entitlements

## Overview
Centralized registry of features enabled/disabled by License Plan and Org Policies.

## Registry
| Key | Name | Free | Pro | Enterprise |
| :--- | :--- | :--- | :--- | :--- |
| `BASIC_CHAT` | Messaging | ✅ | ✅ | ✅ |
| `SSO` | Single Sign-On | ❌ | ❌ | ✅ |
| `EXPORTS` | Data Exports | ❌ | ✅ | ✅ |
| `AUDIT_LOGS` | Audit Logs | ❌ | ✅ | ✅ |

## Logic
`Effective Feature` = `Plan Entitlement` AND `Org Feature Flag`.

- **Entitlement**: Defined by `feature_entitlements` table (System).
- **Flag**: Defined by `feature_flags` table (Org Admin).
- **Invariant**: An Admin cannot enable a flag if the Plan does not entitle it.

## Governance
Changes to usage flags (e.g. disabling Audit Logs) require Governance Approval.
