<?php
// includes/security_alerts.php
// Epic 26: Security Alerts + Suspicious Login Detection

/**
 * Create a new security alert for a user
 */
function createSecurityAlert($pdo, $userId, $type, $severity, $deviceUuid = null, $ip = null, $metadata = null)
{
    $stmt = $pdo->prepare("
        INSERT INTO security_alerts (user_id, alert_type, severity, device_uuid, ip_address, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $metaJson = $metadata ? json_encode($metadata) : null;
    $stmt->execute([$userId, $type, $severity, $deviceUuid, $ip, $metaJson]);

    return $pdo->lastInsertId();
}

/**
 * Mark an alert as read
 */
function markAlertRead($pdo, $userId, $alertId)
{
    $stmt = $pdo->prepare("
        UPDATE security_alerts 
        SET is_read = 1 
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$alertId, $userId]);

    return $stmt->rowCount() > 0;
}

/**
 * Fetch alerts for a user
 * @param PDO $pdo
 * @param string $userId
 * @param int|null $sinceId Only fetch alerts after this ID
 * @param int $limit Max alerts to return
 * @param bool $unreadOnly Only fetch unread alerts
 */
function fetchAlerts($pdo, $userId, $sinceId = null, $limit = 50, $unreadOnly = false)
{
    $sql = "
        SELECT id, alert_type, severity, device_uuid, ip_address, metadata, is_read, created_at
        FROM security_alerts
        WHERE user_id = ?
    ";
    $params = [$userId];

    if ($sinceId) {
        $sql .= " AND id > ?";
        $params[] = $sinceId;
    }

    if ($unreadOnly) {
        $sql .= " AND is_read = 0";
    }

    $sql .= " ORDER BY created_at DESC LIMIT ?";
    $params[] = $limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Decode metadata
    foreach ($alerts as &$alert) {
        if ($alert['metadata']) {
            $alert['metadata'] = json_decode($alert['metadata'], true);
        }
    }

    return $alerts;
}

/**
 * Get unread count for a user
 */
function getUnreadAlertCount($pdo, $userId)
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM security_alerts WHERE user_id = ? AND is_read = 0");
    $stmt->execute([$userId]);
    return (int) $stmt->fetchColumn();
}

/**
 * Helper: Create NEW_DEVICE_LOGIN alert
 */
function alertNewDeviceLogin($pdo, $userId, $deviceUuid, $ip, $userAgent)
{
    return createSecurityAlert($pdo, $userId, 'NEW_DEVICE_LOGIN', 'WARNING', $deviceUuid, $ip, [
        'user_agent' => $userAgent,
        'message' => 'A new device logged into your account'
    ]);
}

/**
 * Helper: Create DEVICE_REVOKED alert
 */
function alertDeviceRevoked($pdo, $userId, $deviceUuid, $ip, $revokedByDevice)
{
    return createSecurityAlert($pdo, $userId, 'DEVICE_REVOKED', 'INFO', $deviceUuid, $ip, [
        'revoked_by' => $revokedByDevice,
        'message' => 'A device was revoked from your account'
    ]);
}

/**
 * Helper: Create ABUSE_LOCK alert
 */
function alertAbuseLock($pdo, $userId, $deviceUuid, $ip, $reason)
{
    return createSecurityAlert($pdo, $userId, 'ABUSE_LOCK', 'CRITICAL', $deviceUuid, $ip, [
        'reason' => $reason,
        'message' => 'Your account was temporarily locked due to suspicious activity'
    ]);
}

/**
 * Helper: Create RATE_LIMIT_BLOCK alert
 */
function alertRateLimitBlock($pdo, $userId, $deviceUuid, $ip, $endpoint)
{
    return createSecurityAlert($pdo, $userId, 'RATE_LIMIT_BLOCK', 'WARNING', $deviceUuid, $ip, [
        'endpoint' => $endpoint,
        'message' => 'Rate limit exceeded'
    ]);
}
