# Governance Model

## Overview
All sensitive administrative actions must pass through the Governance Engine. No single admin can destroy data or perma-ban users without oversight.

## Workflow
1.  **Request**: Admin A submits an action (e.g., `PERMA_BAN` User 123).
2.  **Queue**: The system checks `governance_policies`. If `requires_approval` is true, status = `PENDING`.
3.  **Approval**: Admin B (different ID) reviews and calls `approve_action`.
4.  **Execution**: Once `min_approvers` is met, the system executes the logic (callback or flag).

## Policies
| Action | Approvers | Timeout |
| :--- | :--- | :--- |
| `PERMA_BAN` | 1 | 24h |
| `GDPR_DELETE` | 1 | 24h |
| `DEVICE_REVOKE` | 1 | 12h |
| `EXPORT_DATA` | 1 | 4h |

## Invariants
*   Requester cannot approve their own request.
*   Expired requests cannot be revived.
*   Rejected requests are final.
