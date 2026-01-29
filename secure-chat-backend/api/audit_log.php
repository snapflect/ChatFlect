<?php
/**
 * Audit Logging System
 * Security Enhancement #8: Log security-relevant events for incident investigation
 */

/**
 * Log a security event to the audit_logs table
 * 
 * @param string $action - The action being logged (login, logout, key_change, etc.)
 * @param string|null $userId - The user ID performing the action
 * @param array|string|null $details - Additional details about the event
 */
function auditLog($action, $userId = null, $details = null)
{
    global $conn;

    // Get request metadata
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

    // Convert details to JSON string if array
    if (is_array($details)) {
        $details = json_encode($details);
    }

    try {
        $stmt = $conn->prepare(
            "INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("sssss", $userId, $action, $details, $ipAddress, $userAgent);
        $stmt->execute();
    } catch (Exception $e) {
        // Don't let audit logging failures break the main flow
        error_log("Audit log failed: " . $e->getMessage());
    }

    // v12: Probabilistic Garbage Collection (1/1000 chance)
    if (rand(1, 1000) === 1) {
        purgeOldLogs();
    }
}

/**
 * Purge audit logs older than N days (Default 90)
 * v12: Compliance Requirement - Bounded Log Growth
 */
function purgeOldLogs($retentionDays = 90)
{
    global $conn;
    try {
        $stmt = $conn->prepare("DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL ? DAY");
        $stmt->bind_param("i", $retentionDays);
        $stmt->execute();
    } catch (Exception $e) {
        error_log("Audit GC failed: " . $e->getMessage());
    }
}

// Common audit actions
define('AUDIT_LOGIN_SUCCESS', 'login_success');
define('AUDIT_LOGIN_FAILED', 'login_failed');
define('AUDIT_LOGOUT', 'logout');
define('AUDIT_OTP_REQUESTED', 'otp_requested');
define('AUDIT_OTP_VERIFIED', 'otp_verified');
define('AUDIT_OTP_FAILED', 'otp_failed');
define('AUDIT_PROFILE_UPDATE', 'profile_update');
define('AUDIT_KEY_CHANGE', 'key_change');
define('AUDIT_PASSWORD_CHANGE', 'password_change');
define('AUDIT_ACCOUNT_DELETE', 'account_delete');
define('AUDIT_GROUP_CREATE', 'group_create');
define('AUDIT_GROUP_JOIN', 'group_join');
define('AUDIT_GROUP_LEAVE', 'group_leave');
define('AUDIT_RATE_LIMIT_HIT', 'rate_limit_hit');
define('AUDIT_AUTH_FAILED', 'auth_failed');
define('AUDIT_SUSPICIOUS_ACTIVITY', 'suspicious_activity');
?>