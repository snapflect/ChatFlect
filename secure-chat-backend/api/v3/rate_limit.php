<?php
// api/v3/rate_limit.php

/**
 * Validates Rate Limit for a given key (IP or UserID).
 * Returns TRUE if allowed, FALSE if exceeded.
 * 
 * Uses a simple DB table `rate_limits` (key, count, expires_at).
 */
function checkRateLimit($conn, $key, $limit, $windowSeconds)
{
    // 1. Cleanup old entries (probabilistic or cron?)
    // For every request: expensive. Let's do it 1/100 times.
    if (rand(1, 100) === 1) {
        $conn->query("DELETE FROM rate_limits WHERE expires_at < NOW()");
    }

    $keyHash = md5($key);

    // 2. Check current usage
    $stmt = $conn->prepare("SELECT count, expires_at FROM rate_limits WHERE `key` = ?");
    $stmt->bind_param("s", $keyHash);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows > 0) {
        $row = $res->fetch_assoc();
        if (strtotime($row['expires_at']) < time()) {
            // Expired: Reset
            $upd = $conn->prepare("UPDATE rate_limits SET count = 1, expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE `key` = ?");
            $upd->bind_param("is", $windowSeconds, $keyHash);
            $upd->execute();
            return true;
        } else {
            // Active Window
            if ($row['count'] >= $limit) {
                return false; // BLOCKED
            } else {
                // Increment
                $inc = $conn->prepare("UPDATE rate_limits SET count = count + 1 WHERE `key` = ?");
                $inc->bind_param("s", $keyHash);
                $inc->execute();
                return true;
            }
        }
    } else {
        // New Entry
        $ins = $conn->prepare("INSERT INTO rate_limits (`key`, count, expires_at) VALUES (?, 1, DATE_ADD(NOW(), INTERVAL ? SECOND))");
        $ins->bind_param("si", $keyHash, $windowSeconds);
        $ins->execute();
        return true;
    }
}

// Helper to enforce
function enforceRateLimit($conn, $userId)
{
    $ip = $_SERVER['REMOTE_ADDR'];

    // IP Limit: 500 / min
    if (!checkRateLimit($conn, "IP:$ip", 500, 60)) {
        http_response_code(429);
        echo json_encode(["error" => "Rate Limit Exceeded (IP)"]);
        exit;
    }

    // User Limit: 100 / min
    if ($userId && !checkRateLimit($conn, "USER:$userId", 100, 60)) {
        http_response_code(429);
        echo json_encode(["error" => "Rate Limit Exceeded (User)"]);
        exit;
    }
}
?>