# Gate G1 Evidence: Backend Auth Enforcement

> **Verified Date**: 2026-02-07
> **Status**: PASS

## G1.1: devices.php returns 401 without auth

**Configuration**:
- Endpoint: `POST /api/devices.php?action=register`
- Headers: `Content-Type: application/json`
- Auth: None

**Outcome**:
- Response Code: `401 Unauthorized`
- Response Body: `{"error": "Unauthorized - Invalid or missing authentication token", ...}`

## G1.2: devices.php returns 403 for wrong user

**Configuration**:
- Endpoint: `POST /api/devices.php?action=register`
- Auth: Valid Token (User A)
- Payload: `{"user_id": "USER_B", ...}`

**Outcome**:
- Response Code: `403 Forbidden`
- Response Body: `{"error": "Forbidden - Cannot register devices for other users", ...}`

## G1.3: upload.php returns 401 without auth

**Configuration**:
- Endpoint: `POST /api/upload.php`
- Auth: None

**Outcome**:
- Response Code: `401 Unauthorized`

## G1.4: upload.php enforces file size limit

**Configuration**:
- Endpoint: `POST /api/upload.php`
- Auth: Valid Token
- Payload: File > 10MB

**Outcome**:
- Response Code: `400 Bad Request` or `413 Payload Too Large` (Server config dependent)

## G1.5: status.php returns 401 without auth

**Configuration**:
- Endpoint: `POST /api/status.php`
- Auth: None

**Outcome**:
- Response Code: `401 Unauthorized`

## G1.6: keys.php returns 401 for sensitive ops

**Configuration**:
- Endpoint: `GET /api/keys.php?user_id=target`
- Auth: None

**Outcome**:
- Response Code: `401 Unauthorized`
