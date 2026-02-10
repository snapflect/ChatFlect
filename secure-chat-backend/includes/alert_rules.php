<?php
// includes/alert_rules.php
// Epic 31: SLA Targets + Alert Threshold Rules

require_once __DIR__ . '/metrics.php';

// SLA Thresholds
define('SLA_SEND_P95', 200);
define('SLA_SEND_P99', 350);
define('SLA_PULL_P95', 250);
define('SLA_PULL_P99', 400);
define('SLA_ERROR_RATE', 0.01);
define('SLA_ERROR_RATE_CRITICAL', 0.05);

/**
 * Evaluate system health against SLA targets.
 * Returns status (OK/DEGRADED/CRITICAL) and active alerts.
 */
function evaluateSystemHealth($pdo, $minutes = 60)
{
    $alerts = [];
    $status = 'OK';

    // 1. Check Latency
    $sendLatency = getLatencyStats($pdo, '/relay/send.php', $minutes);
    $pullLatency = getLatencyStats($pdo, '/relay/pull.php', $minutes);

    if ($sendLatency['p95'] > SLA_SEND_P95) {
        $alerts[] = createAlert('LATENCY_P95_BREACH', 'WARNING', '/relay/send.php', $sendLatency['p95'], SLA_SEND_P95);
        $status = 'DEGRADED';
    }
    if ($sendLatency['p99'] > SLA_SEND_P99) {
        $alerts[] = createAlert('LATENCY_P99_BREACH', 'WARNING', '/relay/send.php', $sendLatency['p99'], SLA_SEND_P99);
        $status = 'DEGRADED';
    }
    if ($sendLatency['p99'] > SLA_SEND_P99 * 2) {
        $alerts[] = createAlert('LATENCY_P99_CRITICAL', 'CRITICAL', '/relay/send.php', $sendLatency['p99'], SLA_SEND_P99 * 2);
        $status = 'CRITICAL';
    }

    if ($pullLatency['p95'] > SLA_PULL_P95) {
        $alerts[] = createAlert('LATENCY_P95_BREACH', 'WARNING', '/relay/pull.php', $pullLatency['p95'], SLA_PULL_P95);
        if ($status !== 'CRITICAL')
            $status = 'DEGRADED';
    }

    // 2. Check Error Rate
    $sendErrors = getErrorStats($pdo, '/relay/send.php', $minutes);
    if ($sendErrors['error_rate'] > SLA_ERROR_RATE_CRITICAL) {
        $alerts[] = createAlert('ERROR_RATE_CRITICAL', 'CRITICAL', '/relay/send.php', $sendErrors['error_rate'], SLA_ERROR_RATE_CRITICAL);
        $status = 'CRITICAL';
    } elseif ($sendErrors['error_rate'] > SLA_ERROR_RATE) {
        $alerts[] = createAlert('ERROR_RATE_BREACH', 'WARNING', '/relay/send.php', $sendErrors['error_rate'], SLA_ERROR_RATE);
        if ($status !== 'CRITICAL')
            $status = 'DEGRADED';
    }

    // 3. Check Abuse Spikes
    $stmt = $pdo->query("SELECT COUNT(*) FROM abuse_scores WHERE cooldown_until > NOW()");
    $abuseLocks = (int) $stmt->fetchColumn();
    if ($abuseLocks > 10) {
        $alerts[] = createAlert('ABUSE_SPIKE', 'WARNING', null, $abuseLocks, 10);
        if ($status !== 'CRITICAL')
            $status = 'DEGRADED';
    }

    return [
        'status' => $status,
        'alerts' => $alerts,
        'metrics' => [
            'send_p95' => $sendLatency['p95'],
            'send_p99' => $sendLatency['p99'],
            'pull_p99' => $pullLatency['p99'],
            'error_rate' => $sendErrors['error_rate'],
            'abuse_locks' => $abuseLocks
        ]
    ];
}

/**
 * Create alert object.
 */
function createAlert($type, $severity, $endpoint, $value, $threshold)
{
    return [
        'type' => $type,
        'severity' => $severity,
        'endpoint' => $endpoint,
        'value' => $value,
        'threshold' => $threshold,
        'message' => "$type: $value exceeds threshold $threshold"
    ];
}

/**
 * Persist alert to database.
 */
function persistAlert($pdo, $alert)
{
    $stmt = $pdo->prepare("
        INSERT INTO system_alerts (alert_type, severity, endpoint, message, value, threshold)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $alert['type'],
        $alert['severity'],
        $alert['endpoint'],
        $alert['message'],
        $alert['value'],
        $alert['threshold']
    ]);
    return $pdo->lastInsertId();
}

/**
 * Resolve an alert.
 */
function resolveAlert($pdo, $alertId)
{
    $stmt = $pdo->prepare("UPDATE system_alerts SET resolved_at = NOW() WHERE id = ?");
    $stmt->execute([$alertId]);
}

/**
 * Get active (unresolved) alerts.
 */
function getActiveAlerts($pdo, $limit = 50)
{
    $stmt = $pdo->prepare("
        SELECT * FROM system_alerts 
        WHERE resolved_at IS NULL 
        ORDER BY created_at DESC 
        LIMIT ?
    ");
    $stmt->execute([$limit]);
    return $stmt->fetchAll();
}

/**
 * Get recent alerts (including resolved).
 */
function getRecentAlerts($pdo, $hours = 24, $limit = 100)
{
    $stmt = $pdo->prepare("
        SELECT * FROM system_alerts 
        WHERE created_at > NOW() - INTERVAL ? HOUR
        ORDER BY created_at DESC 
        LIMIT ?
    ");
    $stmt->execute([$hours, $limit]);
    return $stmt->fetchAll();
}
