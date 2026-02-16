# SCIM 2.0 Provisioning Guide

> [!IMPORTANT]
> **TLS Requirement**: SCIM synchronization MUST be performed over HTTPS (TLS 1.2+). Unencrypted usage will expose user data.

> [!CAUTION]
> **API Key Rotation**: The SCIM Bearer Token grants full user management access. Rotate this key immediately if an administrator leaves the organization.

**Base URL**: `https://<YOUR_DOMAIN>/api/scim/v2`

## 1. Capabilities
ChatFlect supports SCIM 2.0 for automating user lifecycle management.
- **Create User**: Provision new accounts upon assignment.
- **Deactivate User**: Revoke access (delete sessions) upon unassignment.
- **Update Attributes**: Sync Display Name and Email changes.

## 2. Configuration (Generic)
- **Base URL**: `https://chat.example.com/api/scim/v2`
- **Authentication**: Bearer Token
- **Token**: Generate an Admin API Key via `api/admin/keys.php`.

## 3. Attribute Mapping
| ChatFlect Field | SCIM Attribute | Required |
| :--- | :--- | :--- |
| `userName` | `userName` (or `email`) | Yes |
| `displayName` | `displayName` | No |
| `active` | `active` | Yes |

## 4. Troubleshooting
**Error 409 Conflict**:
- User already exists. Ensure `userName` is unique.

**Error 401 Unauthorized**:
- API Key is invalid or expired. Rotate key in Admin Console.
