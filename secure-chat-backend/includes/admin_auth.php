<?php
// includes/admin_auth.php
// Epic 27: Admin Moderation Dashboard - Authentication
// Hardened with IP allowlist, access logging, and token rotation via env

/**
 * Log admin access attempts (successful and failed).
 */
function logAdminAccess($success, $adminId, $reason = null)
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    $endpoint = $_SERVER['REQUEST_URI'] ?? 'unknown';

    $logEntry = sprintf(
        "[ADMIN_ACCESS] %s | IP: %s | Admin: %s | Endpoint: %s | Reason: %s | UA: %s",
        $success ? 'SUCCESS' : 'FAILED',
        $ip,
        $adminId ?? 'unknown',
        $endpoint,
        $reason ?? '-',
        substr($userAgent, 0, 100)
    );

    error_log($logEntry);
}

/**
 * Check if current IP is in allowlist.
 * Returns true if allowlist is empty (disabled) or IP is allowed.
 */
function isIpAllowed()
{
    // IP allowlist from environment (comma-separated)
    $allowlistEnv = getenv('ADMIN_IP_ALLOWLIST') ?: '';

    // If empty, allowlist is disabled
    if (empty(trim($allowlistEnv))) {
        return true;
    }

    $allowedIps = array_map('trim', explode(',', $allowlistEnv));
    $currentIp = $_SERVER['REMOTE_ADDR'] ?? '';

    // Check for exact match or CIDR notation (basic support)
    foreach ($allowedIps as $allowed) {
        if ($currentIp === $allowed) {
            return true;
        }
        // Support /24 notation
        if (strpos($allowed, '/') !== false && isIpInCidr($currentIp, $allowed)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if IP is in CIDR range (IPv4 only).
 */
function isIpInCidr($ip, $cidr)
{
    list($subnet, $bits) = explode('/', $cidr);
    $ip = ip2long($ip);
    $subnet = ip2long($subnet);
    $mask = -1 << (32 - $bits);
    return ($ip & $mask) == ($subnet & $mask);
}

/**
 * Require admin authentication via X-Admin-Token header.
 * Returns admin identifier or exits with 401/403.
 */
function requireAdminAuth()
{
    $adminToken = getenv('ADMIN_API_TOKEN') ?: 'CHANGE_ME_IN_PRODUCTION';
    $providedToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    $adminId = $_SERVER['HTTP_X_ADMIN_ID'] ?? 'admin';
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    // 1. IP Allowlist Check
    if (!isIpAllowed()) {
        logAdminAccess(false, $adminId, "IP_NOT_ALLOWED: $ip");
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'IP_NOT_ALLOWED']);
        exit;
    }

    // 2. Token Present Check
    if (empty($providedToken)) {
        logAdminAccess(false, $adminId, 'MISSING_TOKEN');
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'MISSING_ADMIN_TOKEN']);
        exit;
    }

    // 3. Token Valid Check
    if ($providedToken !== $adminToken) {
        logAdminAccess(false, $adminId, 'INVALID_TOKEN');
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'INVALID_ADMIN_TOKEN']);
        exit;
    }

    // Success
    logAdminAccess(true, $adminId);
    return $adminId;
}

/**
 * Log an admin action to the admin_actions table.
 */
function logAdminAction($pdo, $adminId, $targetUserId, $actionType, $metadata = null)
{
    $stmt = $pdo->prepare("
        INSERT INTO admin_actions (admin_id, target_user_id, action_type, metadata)
        VALUES (?, ?, ?, ?)
    ");
    $metaJson = $metadata ? json_encode($metadata) : null;
    $stmt->execute([$adminId, $targetUserId, $actionType, $metaJson]);

    return $pdo->lastInsertId();
}

/**
 * Get PDO connection (reuses from db.php if available, otherwise creates new)
 */
function getAdminPdo()
{
    if (function_exists('getDbPdo')) {
        return getDbPdo();
    }

    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=localhost;dbname=u668772406_secure_chat;charset=utf8mb4',
            'u668772406_chat_admin',
            'MusMisMM@1',
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]
        );
    }
    return $pdo;
}
