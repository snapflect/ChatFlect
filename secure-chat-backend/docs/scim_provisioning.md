# SCIM Provisioning

## Overview
Automated user lifecycle management for Enterprise customers using SCIM 2.0.

## Authentication
- **Bearer Token**: Generated via Admin Console. Scoped to Org.
- **Header**: `Authorization: Bearer <token>`

## Invariants
- **Owner Protection**: SCIM cannot create, delete, or modify OWNER accounts.
- **Soft Delete**: `DELETE /Users` maps to `status=DISABLED`.
- **Audit**: All SCIM actions are logged in `scim_events`.

## Endpoints
- `POST /Users`: Provision new member.
- `PATCH /Users/{id}`: Update / Disable.
- `DELETE /Users/{id}`: Disable.
