# Enterprise Licensing & Entitlements

## 1. Seat Management
ChatFlect is licensed by **Active User Seats**.
- **Active User**: Any user who has performed an authenticated action (Login, Message Send, Key Exchange) in the last 30 days.
- **Overage**: The system will alert Admins when at 90% capacity but will NOT block login unless explicitly configured to `BLOCK_OVERAGE=true`.

## 2. Feature Flags
Enterprise features are controlled via `config/features.json` or Environment Variables.

| Feature | Env Var | Description |
| :--- | :--- | :--- |
| **SSO** | `FEATURE_SSO_ENABLED=true` | Enables OIDC Login |
| **SCIM** | `FEATURE_SCIM_ENABLED=true` | Enables Provisioning API |
| **Audit Logs** | `FEATURE_AUDIT_LOGS=true` | Enables SIEM Export |
| **DLP** | `FEATURE_DLP_ENABLED=true` | Enables Message keyword scanning |

> [!NOTE]
> **Compliance**: Enabling `FEATURE_AUDIT_LOGS` is recommended for SOC 2 / HIPAA compliance. Ensure your SIEM ingestion pipeline is configured before enabling to avoid disk saturation.

## 3. Auditing Usage
Admins can query usage via the API:
```bash
curl -H "Authorization: Bearer <ADMIN_KEY>" https://chat.example.com/api/admin/usage.php
```
Response:
```json
{
  "seats_purchased": 1000,
  "seats_used": 450,
  "seats_available": 550,
  "compliance_status": "ok"
}
```
