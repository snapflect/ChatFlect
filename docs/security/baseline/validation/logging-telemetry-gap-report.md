# Logging & Telemetry Gap Report (TASK 1.4-K) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Status**: P0 Complete

---

## Executive Summary

Audit of logging and telemetry infrastructure reveals **significant gaps** in security event monitoring. While basic audit logging exists in the backend, critical events are not logged consistently.

| Area | Current State | Gap Severity |
| :--- | :---: | :---: |
| Backend API Logging | ⚠️ Partial | HIGH |
| Device Registration Audit | ✓ Present | LOW |
| Login Attempt Logging | ⚠️ Partial | MEDIUM |
| Key Operations Logging | ❌ Missing | HIGH |
| Firestore Rule Denials | ❌ Missing | MEDIUM |
| Client Security Events | ❌ Missing | HIGH |
| Error Telemetry | ⚠️ Partial | MEDIUM |

---

## Backend API Logging Analysis

### Audit Log Service

**File**: `secure-chat-backend/api/audit_log.php`

```php
// Audit logging function exists
function auditLog($eventType, $userId, $metadata = []) {
    // Logs to audit_logs table
}
```

**Verified Usage**:
| Endpoint | Event Logged | Code Reference |
| :--- | :--- | :--- |
| devices.php | `device_registered` | ✓ Present |
| devices.php | `DEVICE_EVICTED_MAX_LIMIT` | ✓ Present |
| devices.php | `device_revoked` | ✓ Present |
| groups.php | Group actions | ⚠️ Partial |
| upload.php | File uploads | ❌ Missing |
| keys.php | Key fetches | ❌ Missing |
| status.php | Status updates | ❌ Missing |

### Missing Audit Events

| Event | Importance | Status |
| :--- | :---: | :---: |
| Failed authentication attempts | HIGH | ❌ Not logged |
| Key fetch by user | MEDIUM | ❌ Not logged |
| File upload | MEDIUM | ❌ Not logged |
| Profile access | MEDIUM | ❌ Not logged |
| Contact search | HIGH | ❌ Not logged |
| API rate limit exceeded | HIGH | ⚠️ Partial |

---

## Device Registration Audit

### Current State: ✓ Adequate

**Events Logged**:
- Device registration
- Device eviction (max limit)
- Device revocation

**Code Evidence**:
```php
// devices.php - Line 140
auditLog('device_registered', $userId, ['device_uuid' => $deviceUuid]);

// devices.php - Line 120
auditLog('DEVICE_EVICTED_MAX_LIMIT', $userId, [
    'evicted_device' => $oldest['device_uuid'],
    'new_device' => $deviceUuid,
    'reason' => 'max_limit_reached'
]);
```

**Gap**: No logging of failed registration attempts or suspicious patterns.

---

## Login Attempt Logging

### Current State: ⚠️ Partial

**What's Logged**:
- Successful OTP verification (Firebase side)

**What's Missing**:
- Failed OTP attempts
- OTP request rate limiting events
- Suspicious login patterns
- Geographic anomaly detection

**Recommendation**:
```php
// Add to firebase_auth.php
auditLog('login_success', $userId, [
    'ip' => $_SERVER['REMOTE_ADDR'],
    'user_agent' => $_SERVER['HTTP_USER_AGENT'],
    'method' => 'otp'
]);

auditLog('login_failed', $userId, [
    'ip' => $_SERVER['REMOTE_ADDR'],
    'reason' => 'invalid_token'
]);
```

---

## Key Operations Logging

### Current State: ❌ Missing

**Critical Gap**: No logging of:
- Public key fetches
- Key updates/rotations
- Key bundle requests
- Suspicious key access patterns

**Security Impact**:
- Cannot detect key injection attacks (E1)
- Cannot audit who accessed keys
- No forensic trail for compromise investigation

**Required Events**:
| Event | Fields | Priority |
| :--- | :--- | :---: |
| `key_fetch` | requester_id, target_id, timestamp | HIGH |
| `key_update` | user_id, device_uuid, old_key_hash, new_key_hash | HIGH |
| `key_rotation` | user_id, reason | HIGH |

---

## Firestore Rule Denial Logging

### Current State: ❌ Missing

**Issue**: When Firestore security rules deny access, there's no visibility.

**Firebase Limitations**:
- Firebase doesn't log rule denials by default
- Requires Cloud Functions or Security Rules Logging (Preview)

**Recommendation**:
1. Enable Firestore Security Rules logging (if available)
2. Add Cloud Function trigger for suspicious patterns
3. Monitor for high denial rates

---

## Client Security Event Logging

### Current State: ❌ Missing

**No client-side logging for**:
- Decryption failures
- Key not found errors
- Token refresh events
- Suspicious activity
- localStorage tampering detection

**Required Events**:
| Event | Fields | Priority |
| :--- | :--- | :---: |
| `decrypt_failed` | message_id, error_type | HIGH |
| `key_missing` | sender_id, device_uuid | HIGH |
| `token_refresh` | success/failure | MEDIUM |
| `backup_created` | timestamp | MEDIUM |
| `backup_restored` | timestamp | MEDIUM |
| `storage_integrity_fail` | key, expected_hash | HIGH |

---

## Rate Limiting Metrics

### Current State: ⚠️ Partial

**Implemented**:
- `rate_limiter.php` enforces rate limits

**Missing**:
- Metrics on rate limit hits
- Alerting on abuse patterns
- Per-endpoint rate statistics

**Recommendation**:
```php
// Add to rate_limiter.php
function logRateLimitExceeded($ip, $endpoint) {
    auditLog('rate_limit_exceeded', null, [
        'ip' => $ip,
        'endpoint' => $endpoint,
        'count' => $currentCount,
        'limit' => $limit
    ]);
}
```

---

## Correlation ID Gap

### Current State: ❌ Missing

**Issue**: No request correlation across:
- Client → Backend
- Backend → Firebase
- Firebase → Client

**Impact**:
- Cannot trace request flow
- Difficult to debug issues
- Cannot correlate security events

**Recommendation**:
1. Generate `X-Request-ID` on client
2. Pass through all API calls
3. Log with correlation ID in audit table

---

## Tamper Evidence Gap

### Current State: ❌ Missing

**No detection for**:
- localStorage tampering
- Message deletion without trace
- Timestamp manipulation

**Recommendation**:
- Implement integrity checks on localStorage
- Log all message deletions
- Server-side timestamp enforcement

---

## Gap Summary Matrix

| Category | Critical Gaps | High Gaps | Medium Gaps |
| :--- | :---: | :---: | :---: |
| API Logging | 0 | 3 | 2 |
| Key Operations | 3 | 0 | 0 |
| Client Events | 3 | 2 | 2 |
| Firestore | 1 | 1 | 0 |
| Correlation | 1 | 0 | 0 |
| **Total** | **8** | **6** | **4** |

---

## Remediation Roadmap

### Sprint 1 (Critical)

| Item | Description | LOE |
| :--- | :--- | :---: |
| Key fetch logging | Log all keys.php access | S |
| Failed auth logging | Log failed OTP/JWT | S |
| Rate limit metrics | Log exceeded limits | S |

### Sprint 2 (High)

| Item | Description | LOE |
| :--- | :--- | :---: |
| Correlation IDs | Add X-Request-ID | M |
| Client event SDK | Create logging service | M |
| Upload audit | Log file uploads | S |

### Sprint 3 (Medium)

| Item | Description | LOE |
| :--- | :--- | :---: |
| Firestore logging | Enable rule denial logs | M |
| Tamper detection | Integrity checks | L |
| Alerting | Set up thresholds | M |

---

## Validation Status

| Acceptance Criteria | Status |
| :--- | :---: |
| Verify audit logs for device registration | ✓ Present |
| Verify login attempt logs | ⚠️ Partial |
| Verify suspicious activity detection | ❌ Missing |
| Verify rate limiting metrics | ⚠️ Partial |
| Verify Firestore monitoring | ❌ Missing |
| Identify missing backend logs | ✓ Done |
| Identify missing correlation IDs | ✓ Done |
| Identify missing tamper evidence | ✓ Done |
