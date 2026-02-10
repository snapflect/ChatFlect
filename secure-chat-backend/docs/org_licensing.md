# Org Licensing

## Overview
Commercial enforcement for ChatFlect Organizations.

## Plans
- **FREE**: 5 Seats. Basic features.
- **PRO**: 50 Seats. Exports, Audit Log.
- **ENTERPRISE**: 1000+ Seats. SSO, SCIM, Governance.

## Enforcement
- **Seat Limit**: Hard block on `invite` and `scim create` if limit reached.
- **Expiry**: If subscription expires, `status=EXPIRED`. All premium features (Exports, SSO) stop working. Basic access remains (read-only mode logic can be added later).
- **Governance**: Any change to Plans/Seats requires `ORG_LICENSE_UPDATE` approval.
