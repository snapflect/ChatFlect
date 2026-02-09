# Org Admin Console

## Access Control
Strictly limited to `OWNER` and `ADMIN` roles.

## Features
1. **Member Management**:
   - List Roster
   - Promote/Demote (Rules applied)
   - Disable/Kick

2. **Device Visibility**:
   - See all devices connected to Org users.
   - Status: Active, Revoked, Trusted.

3. **Audit**:
   - Visibility into org-scoped actions.

## Role Matrix
| Action | Owner | Admin | Member |
| :--- | :---: | :---: | :---: |
| View Roster | ✅ | ✅ | ❌ |
| Edit Role | ✅ | ✅* | ❌ |
| Disable | ✅ | ✅ | ❌ |
| View Audit | ✅ | ✅ | ❌ |

*\* Admins cannot edit Owners or other Admins.*
