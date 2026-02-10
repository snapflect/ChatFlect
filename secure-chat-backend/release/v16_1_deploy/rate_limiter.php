<?php
/**
 * Rate Limiter Middleware
 * Security Enhancement #7: Prevent DoS attacks by limiting request frequency
 */

require_once 'db.php';

// Configuration
define('RATE_LIMIT_REQUESTS', 100);  // Max requests
define('RATE_LIMIT_WINDOW', 60);     // Per X seconds
define('RATE_LIMIT_ENABLED', true);  // v12: Enabled by default

/**
 * Check and enforce rate limits
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit($userId = null, $endpoint = null, $limit = null, $window = null)
{
    global $conn;

    if (!RATE_LIMIT_ENABLED)
        return true;

    $maxRequests = $limit ?? RATE_LIMIT_REQUESTS;
    $timeWindow = $window ?? RATE_LIMIT_WINDOW;

    // v12: Priority Resolution
    // 1. User ID (Authenticated)
    // 2. Device UUID (Header)
    // 3. IP Address (Fallback)
    $identifier = $userId;
    $type = 'user';

    if (!$identifier) {
        $headers = function_exists('apache_request_headers') ? apache_request_headers() : [];
        $deviceUuid = $headers['X-Device-UUID'] ?? $_SERVER['HTTP_X_DEVICE_UUID'] ?? null;

        if ($deviceUuid) {
            $identifier = $deviceUuid;
            $type = 'device';
        } else {
            $identifier = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $type = 'ip';
        }
    }

    // Use request URI if no endpoint provided
    if ($endpoint === null) {
        $endpoint = $_SERVER['REQUEST_URI'] ?? 'unknown';
        // Normalize endpoint (remove query string)
        $endpoint = strtok($endpoint, '?');
    }

    $now = time();
    $windowStart = $now - $timeWindow;

    // Clean up old entries
    $cleanStmt = $conn->prepare("DELETE FROM rate_limits WHERE window_start < FROM_UNIXTIME(?)");
    $cleanStmt->bind_param("i", $windowStart);
    $cleanStmt->execute();

    // Check current count
    // Note: We prepend type prefix to identifier to avoid collisions (e.g. user:123 vs ip:123)
    $dbIdentifier = "$type:$identifier";

    $checkStmt = $conn->prepare(
        "SELECT request_count FROM rate_limits 
         WHERE identifier = ? AND endpoint = ? AND window_start >= FROM_UNIXTIME(?)"
    );
    $checkStmt->bind_param("ssi", $dbIdentifier, $endpoint, $windowStart);
    $checkStmt->execute();
    $result = $checkStmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $currentCount = $row['request_count'];

        if ($currentCount >= $maxRequests) {
            return false; // Rate limited
        }

        // Increment counter
        $updateStmt = $conn->prepare(
            "UPDATE rate_limits SET request_count = request_count + 1 
             WHERE identifier = ? AND endpoint = ?"
        );
        $updateStmt->bind_param("ss", $dbIdentifier, $endpoint);
        $updateStmt->execute();
    } else {
        // Create new entry
        $insertStmt = $conn->prepare(
            "INSERT INTO rate_limits (identifier, endpoint, request_count, window_start) 
             VALUES (?, ?, 1, FROM_UNIXTIME(?))"
        );
        $insertStmt->bind_param("ssi", $dbIdentifier, $endpoint, $now);
        $insertStmt->execute();
    }

    return true;
}

/**
 * Enforce rate limit - returns 429 if exceeded
 */
function enforceRateLimit($userId = null, $limit = null, $window = null)
{
    if (!checkRateLimit($userId, null, $limit, $window)) {
        http_response_code(429);
        $retryAfter = $window ?? RATE_LIMIT_WINDOW;
        header('Retry-After: ' . $retryAfter);

        // Log the excessive hit (optional analytics)
        // auditLog(AUDIT_RATE_LIMIT_HIT, $userId, ['endpoint' => $_SERVER['REQUEST_URI']]);

        echo json_encode([
            "error" => "Too Many Requests",
            "retry_after" => $retryAfter
        ]);
        exit;
    }
}
?>