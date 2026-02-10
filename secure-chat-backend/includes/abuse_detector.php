<?php
// includes/abuse_detector.php
// Epic 24: Spam Detection Heuristics

// Risk Level Thresholds
define('ABUSE_THRESHOLD_MEDIUM', 50);
define('ABUSE_THRESHOLD_HIGH', 100);
define('ABUSE_THRESHOLD_CRITICAL', 150);
define('ABUSE_LOCKOUT_MINUTES', 30);

/**
 * Record an abuse event and update the user's score incrementally.
 * 
 * @param PDO $pdo
 * @param string $userId
 * @param string|null $deviceUuid
 * @param string $ip
 * @param string $eventType (BURST_SEND, NEW_BLAST, REPAIR_ABUSE, etc.)
 * @param int $weight
 * @param array|null $metadata
 */
function recordAbuseEvent($pdo, $userId, $deviceUuid, $ip, $eventType, $weight, $metadata = null)
{
    // 1. Insert Event
    $stmt = $pdo->prepare("
        INSERT INTO abuse_events (user_id, device_uuid, ip_address, event_type, weight, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $metaJson = $metadata ? json_encode($metadata) : null;
    $stmt->execute([$userId, $deviceUuid, $ip, $eventType, $weight, $metaJson]);

    // 2. Update Score Incrementally (Upsert)
    // Calculate new score: existing + weight (capped at 500 to prevent infinite growth)
    $stmt = $pdo->prepare("
        INSERT INTO abuse_scores (user_id, score, risk_level, last_updated)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            score = LEAST(score + VALUES(score), 500),
            risk_level = CASE 
                WHEN LEAST(score + VALUES(score), 500) >= ? THEN 'CRITICAL'
                WHEN LEAST(score + VALUES(score), 500) >= ? THEN 'HIGH'
                WHEN LEAST(score + VALUES(score), 500) >= ? THEN 'MEDIUM'
                ELSE 'LOW'
            END,
            last_updated = NOW(),
            cooldown_until = CASE 
                WHEN LEAST(score + VALUES(score), 500) >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
                ELSE cooldown_until
            END
    ");

    $riskLevel = getRiskLevelFromScore($weight);
    $stmt->execute([
        $userId,
        $weight,
        $riskLevel,
        ABUSE_THRESHOLD_CRITICAL,
        ABUSE_THRESHOLD_HIGH,
        ABUSE_THRESHOLD_MEDIUM,
        ABUSE_THRESHOLD_CRITICAL,
        ABUSE_LOCKOUT_MINUTES
    ]);

    // 3. If CRITICAL, log ABUSE_LOCK event and create security alert
    $newScore = getAbuseScore($pdo, $userId);
    if ($newScore['risk_level'] === 'CRITICAL' && $eventType !== 'ABUSE_LOCK') {
        // Log the lock event (prevent recursion by checking eventType)
        $stmt = $pdo->prepare("
            INSERT INTO abuse_events (user_id, device_uuid, ip_address, event_type, weight, metadata)
            VALUES (?, ?, ?, 'ABUSE_LOCK', 0, ?)
        ");
        $stmt->execute([$userId, $deviceUuid, $ip, json_encode(['triggered_by' => $eventType])]);

        error_log("[ABUSE] User $userId LOCKED for " . ABUSE_LOCKOUT_MINUTES . " minutes. Event: $eventType");

        // Create Security Alert (Epic 26)
        require_once __DIR__ . '/security_alerts.php';
        alertAbuseLock($pdo, $userId, $deviceUuid, $ip, $eventType);
    }
}

/**
 * Get the current abuse score for a user (reads from abuse_scores).
 * 
 * @param PDO $pdo
 * @param string $userId
 * @return array { score, risk_level, cooldown_until }
 */
function getAbuseScore($pdo, $userId)
{
    $stmt = $pdo->prepare("SELECT score, risk_level, cooldown_until FROM abuse_scores WHERE user_id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return ['score' => 0, 'risk_level' => 'LOW', 'cooldown_until' => null];
    }

    return $row;
}

/**
 * Check if user is allowed to perform action based on abuse score.
 * 
 * @param PDO $pdo
 * @param string $userId
 * @return array { allowed: bool, action: string, risk_level: string, delay_ms: int }
 */
function checkAbuse($pdo, $userId)
{
    $scoreData = getAbuseScore($pdo, $userId);

    // Check cooldown first
    if ($scoreData['cooldown_until']) {
        $cooldownTime = strtotime($scoreData['cooldown_until']);
        if ($cooldownTime > time()) {
            $remaining = $cooldownTime - time();
            return [
                'allowed' => false,
                'action' => 'LOCKED',
                'risk_level' => 'CRITICAL',
                'cooldown_until' => $scoreData['cooldown_until'],
                'retry_after_sec' => $remaining
            ];
        }
    }

    switch ($scoreData['risk_level']) {
        case 'CRITICAL':
            return [
                'allowed' => false,
                'action' => 'BLOCKED',
                'risk_level' => 'CRITICAL',
                'delay_ms' => 0
            ];
        case 'HIGH':
            return [
                'allowed' => false,
                'action' => 'REJECTED',
                'risk_level' => 'HIGH',
                'delay_ms' => 0
            ];
        case 'MEDIUM':
            return [
                'allowed' => true,
                'action' => 'DELAYED',
                'risk_level' => 'MEDIUM',
                'delay_ms' => 1000
            ];
        default:
            return [
                'allowed' => true,
                'action' => 'ALLOWED',
                'risk_level' => 'LOW',
                'delay_ms' => 0
            ];
    }
}

/**
 * Decay scores periodically (call from cron or on read)
 * Reduces score by 10% every hour if no new events.
 */
function decayAbuseScores($pdo)
{
    $pdo->query("
        UPDATE abuse_scores 
        SET score = GREATEST(score - 10, 0),
            risk_level = CASE 
                WHEN GREATEST(score - 10, 0) >= " . ABUSE_THRESHOLD_CRITICAL . " THEN 'CRITICAL'
                WHEN GREATEST(score - 10, 0) >= " . ABUSE_THRESHOLD_HIGH . " THEN 'HIGH'
                WHEN GREATEST(score - 10, 0) >= " . ABUSE_THRESHOLD_MEDIUM . " THEN 'MEDIUM'
                ELSE 'LOW'
            END
        WHERE last_updated < NOW() - INTERVAL 1 HOUR
    ");
}

/**
 * Helper: Get risk level from score value
 */
function getRiskLevelFromScore($score)
{
    if ($score >= ABUSE_THRESHOLD_CRITICAL)
        return 'CRITICAL';
    if ($score >= ABUSE_THRESHOLD_HIGH)
        return 'HIGH';
    if ($score >= ABUSE_THRESHOLD_MEDIUM)
        return 'MEDIUM';
    return 'LOW';
}

/**
 * Block response helper for abuse
 */
function sendAbuseBlockResponse($abuseResult)
{
    http_response_code($abuseResult['risk_level'] === 'CRITICAL' ? 403 : 429);
    header('Content-Type: application/json');

    if (isset($abuseResult['retry_after_sec'])) {
        header("Retry-After: " . $abuseResult['retry_after_sec']);
    }

    echo json_encode([
        'error' => 'ABUSE_BLOCKED',
        'risk_level' => $abuseResult['risk_level'],
        'action' => $abuseResult['action'],
        'retry_after_sec' => $abuseResult['retry_after_sec'] ?? null,
        'message' => 'Suspicious activity detected. Please try again later.'
    ]);
    exit;
}
