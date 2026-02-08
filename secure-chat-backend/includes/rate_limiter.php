<?php
// includes/rate_limiter.php
// Epic 23: Rate Limiting Framework

require_once __DIR__ . '/logger.php';

if (!function_exists('checkRateLimit')) {

    /**
     * Enforce Rolling Window Rate Limit
     * 
     * @param mysqli $conn DB Connection
     * @param string|null $userId User ID (Optional)
     * @param string|null $deviceUuid Device UUID (Optional)
     * @param string $ip IP Address
     * @param string $endpoint API Endpoint Name
     * @param int $limit Max Requests
     * @param int $window Window in Seconds
     * @return void Exits with 429 if limited
     */
    function checkRateLimit($conn, $userId, $deviceUuid, $ip, $endpoint, $limit, $window)
    {

        // 1. Garbage Collect (1% Chance)
        if (rand(1, 100) === 1) {
            // Delete events older than 1 hour (max window we expect is 10m=600s, so 1h is safe buffer)
            $conn->query("DELETE FROM rate_limit_events WHERE created_at < NOW() - INTERVAL 1 HOUR");
        }

        // 2. Count Requests in Window
        // Use the most specific key available
        $keyType = 'ip';
        $keyValue = $ip;

        if ($deviceUuid) {
            $keyType = 'device';
            $stmt = $conn->prepare("SELECT COUNT(*) FROM rate_limit_events WHERE device_uuid = ? AND endpoint = ? AND created_at > NOW() - INTERVAL ? SECOND");
            $stmt->bind_param("ssi", $deviceUuid, $endpoint, $window);
        } elseif ($userId) {
            $keyType = 'user';
            $stmt = $conn->prepare("SELECT COUNT(*) FROM rate_limit_events WHERE user_id = ? AND endpoint = ? AND created_at > NOW() - INTERVAL ? SECOND");
            $stmt->bind_param("ssi", $userId, $endpoint, $window);
        } else {
            // IP Fallback
            $stmt = $conn->prepare("SELECT COUNT(*) FROM rate_limit_events WHERE ip_address = ? AND endpoint = ? AND created_at > NOW() - INTERVAL ? SECOND");
            $stmt->bind_param("ssi", $ip, $endpoint, $window);
        }

        $stmt->execute();
        $count = $stmt->get_result()->fetch_row()[0];
        $stmt->close();

        // 3. Block if Limit Exceeded
        if ($count >= $limit) {
            $retryAfter = ceil($window / 2); // Simple heuristic: wait half window

            http_response_code(429);
            header("Retry-After: $retryAfter");
            header('Content-Type: application/json');

            echo json_encode([
                "error" => "RATE_LIMITED",
                "endpoint" => $endpoint,
                "limit" => $limit,
                "window_sec" => $window,
                "retry_after_sec" => $retryAfter,
                "message" => "Too many requests. Please wait.",
                "request_id" => RequestContext::getRequestId()
            ]);

            // Log Abuse (Structured)
            logSecurity('RATE_LIMIT_HIT', [
                'key_type' => $keyType,
                'key_value' => $keyValue,
                'endpoint' => $endpoint,
                'count' => $count,
                'limit' => $limit
            ]);

            // Epic 29: Increment counter
            require_once __DIR__ . '/metrics.php';
            incrementCounter(getDbPdo(), 'rate_limit_blocks_total');

            // Epic 26: Create RATE_LIMIT_BLOCK alert for escalation (after 2x violations)
            // With 30-min cooldown to prevent alert spam
            if ($count >= $limit * 2 && $userId) {
                require_once __DIR__ . '/../api/db.php';
                require_once __DIR__ . '/security_alerts.php';
                $pdo = getDbPdo();

                // Check if alert was created in last 30 minutes
                $cooldownStmt = $pdo->prepare("
                    SELECT COUNT(*) FROM security_alerts 
                    WHERE user_id = ? AND alert_type = 'RATE_LIMIT_BLOCK' 
                    AND created_at > NOW() - INTERVAL 30 MINUTE
                ");
                $cooldownStmt->execute([$userId]);
                $recentAlerts = $cooldownStmt->fetchColumn();

                if ($recentAlerts == 0) {
                    alertRateLimitBlock($pdo, $userId, $deviceUuid ?? 'unknown', $ip, $endpoint);
                }
            }

            exit;
        }

        // 4. Record Event (Allowed)
        // Generate UUIDv7 (or v4 fallback)
        $reqUuid = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );

        $stmt = $conn->prepare("INSERT INTO rate_limit_events (request_uuid, user_id, device_uuid, ip_address, endpoint) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssss", $reqUuid, $userId, $deviceUuid, $ip, $endpoint);
        $stmt->execute();
        $stmt->close();
    }
}

if (!function_exists('checkRateLimitPDO')) {
    /**
     * PDO Version of Rate Limiter
     */
    function checkRateLimitPDO($pdo, $userId, $deviceUuid, $ip, $endpoint, $limit, $window)
    {

        // 1. Garbage Collect (1% Chance)
        if (rand(1, 100) === 1) {
            $pdo->query("DELETE FROM rate_limit_events WHERE created_at < NOW() - INTERVAL 1 HOUR");
        }

        // 2. Count Requests in Window
        $keyType = 'ip';
        $keyValue = $ip;

        if ($deviceUuid) {
            $keyType = 'device';
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM rate_limit_events WHERE device_uuid = ? AND endpoint = ? AND created_at > NOW() - INTERVAL ? SECOND");
            $stmt->execute([$deviceUuid, $endpoint, $window]);
        } elseif ($userId) {
            $keyType = 'user';
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM rate_limit_events WHERE user_id = ? AND endpoint = ? AND created_at > NOW() - INTERVAL ? SECOND");
            $stmt->execute([$userId, $endpoint, $window]);
        } else {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM rate_limit_events WHERE ip_address = ? AND endpoint = ? AND created_at > NOW() - INTERVAL ? SECOND");
            $stmt->execute([$ip, $endpoint, $window]);
        }

        $count = $stmt->fetchColumn();

        // 3. Block if Limit Exceeded
        if ($count >= $limit) {
            $retryAfter = ceil($window / 2);

            http_response_code(429);
            header("Retry-After: $retryAfter");
            header('Content-Type: application/json');

            echo json_encode([
                "error" => "RATE_LIMITED",
                "endpoint" => $endpoint,
                "limit" => $limit,
                "window_sec" => $window,
                "retry_after_sec" => $retryAfter
            ]);

            error_log("[RATE_LIMIT] Blocked $keyType:$keyValue on $endpoint ($count >= $limit)");
            exit;
        }

        // 4. Record Event
        $reqUuid = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );

        $stmt = $pdo->prepare("INSERT INTO rate_limit_events (request_uuid, user_id, device_uuid, ip_address, endpoint) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$reqUuid, $userId, $deviceUuid, $ip, $endpoint]);
    }
}
