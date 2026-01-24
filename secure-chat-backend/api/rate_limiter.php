<?php
/**
 * Rate Limiter Middleware
 * Security Enhancement #7: Prevent DoS attacks by limiting request frequency
 */

require_once 'db.php';

// Configuration
define('RATE_LIMIT_REQUESTS', 100);  // Max requests
define('RATE_LIMIT_WINDOW', 60);     // Per X seconds
define('RATE_LIMIT_ENABLED', true);  // Toggle for testing

/**
 * Check and enforce rate limits
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit($identifier = null, $endpoint = null)
{
    global $conn;

    if (!RATE_LIMIT_ENABLED)
        return true;

    // Use IP address if no identifier provided
    if ($identifier === null) {
        $identifier = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }

    // Use request URI if no endpoint provided
    if ($endpoint === null) {
        $endpoint = $_SERVER['REQUEST_URI'] ?? 'unknown';
        // Normalize endpoint (remove query string)
        $endpoint = strtok($endpoint, '?');
    }

    $now = time();
    $windowStart = $now - RATE_LIMIT_WINDOW;

    // Clean up old entries
    $cleanStmt = $conn->prepare("DELETE FROM rate_limits WHERE window_start < FROM_UNIXTIME(?)");
    $cleanStmt->bind_param("i", $windowStart);
    $cleanStmt->execute();

    // Check current count
    $checkStmt = $conn->prepare(
        "SELECT request_count FROM rate_limits 
         WHERE identifier = ? AND endpoint = ? AND window_start >= FROM_UNIXTIME(?)"
    );
    $checkStmt->bind_param("ssi", $identifier, $endpoint, $windowStart);
    $checkStmt->execute();
    $result = $checkStmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $currentCount = $row['request_count'];

        if ($currentCount >= RATE_LIMIT_REQUESTS) {
            return false; // Rate limited
        }

        // Increment counter
        $updateStmt = $conn->prepare(
            "UPDATE rate_limits SET request_count = request_count + 1 
             WHERE identifier = ? AND endpoint = ?"
        );
        $updateStmt->bind_param("ss", $identifier, $endpoint);
        $updateStmt->execute();
    } else {
        // Create new entry
        $insertStmt = $conn->prepare(
            "INSERT INTO rate_limits (identifier, endpoint, request_count, window_start) 
             VALUES (?, ?, 1, NOW())"
        );
        $insertStmt->bind_param("ss", $identifier, $endpoint);
        $insertStmt->execute();
    }

    return true;
}

/**
 * Enforce rate limit - returns 429 if exceeded
 */
function enforceRateLimit($identifier = null)
{
    if (!checkRateLimit($identifier)) {
        http_response_code(429);
        header('Retry-After: ' . RATE_LIMIT_WINDOW);
        echo json_encode([
            "error" => "Too Many Requests",
            "retry_after" => RATE_LIMIT_WINDOW
        ]);
        exit;
    }
}
?>