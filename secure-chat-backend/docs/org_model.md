# Organization Model & Roles

## Overview
ChatFlect supports multi-tenancy through **Organizations**. An Organization allows a group of users to share resources, policies, and billing.

## Roles

| Role | Power Level | Capabilities |
| :--- | :--- | :--- |
| **OWNER** | Superuser | Full control. Managed billing. Can delete Org. Can manage all roles. |
| **ADMIN** | Manager | Can invite/remove members. Can change policies. Cannot delete Org. |
| **MEMBER** | User | Standard access. Chat, File Share, etc. |
| **AUDITOR** | Read-Only | Compliance access. Can view logs and reports. Cannot verify/approve actions. |

## Invariants
1. **Ownership**: An Org must have at least one `ACTIVE` Owner at all times.
2. **Isolation**: A user cannot access data for an Org they are not a member of.
3. **Invite Security**: Invites are token-based, single-use, and expire in 24 hours.

## Schema
- `organizations`: Identity
- `org_members`: Membership map (User N <-> 1 Org)
- `org_invites`: Pending headers
