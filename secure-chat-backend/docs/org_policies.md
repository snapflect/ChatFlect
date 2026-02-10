# Org Policies

## JSON Schema
Configurable via `active_policy` JSON blob.

```json
{
  "device_approval_required": boolean, // Default: false
  "allow_exports": boolean, // Default: true
  "max_devices_per_user": integer, // Default: 5
  "retention_days": integer, // Default: 30
  "require_trusted_device": boolean // Default: false
}
```

## Enforcement Points
1. **Device Registration**: Checks `max_devices_per_user` and `device_approval_required`.
2. **File Export**: checks `allow_exports`.
3. **Data Cleanup**: Cron checks `retention_days`.
