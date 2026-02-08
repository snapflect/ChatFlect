<?php
// includes/metrics.php
// Epic 29: Metrics Collection + Latency Dashboard

require_once __DIR__ . '/request_context.php';

/**
 * Record a request metric.
 */
function recordMetric($pdo, $endpoint, $method, $statusCode, $durationMs)
{
    try {
        $stmt = $pdo->prepare("
            INSERT INTO api_metrics (request_id, endpoint, method, user_id, device_uuid, status_code, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            RequestContext::getRequestId(),
            $endpoint,
            $method,
            RequestContext::getUserId(),
            RequestContext::getDeviceUuid(),
            $statusCode,
            $durationMs
        ]);
    } catch (Exception $e) {
        error_log("[METRICS] Failed to record: " . $e->getMessage());
    }
}

/**
 * Increment a system counter.
 */
function incrementCounter($pdo, $key, $value = 1)
{
    try {
        $stmt = $pdo->prepare("
            INSERT INTO system_counters (metric_key, metric_value) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE metric_value = metric_value + ?, updated_at = NOW()
        ");
        $stmt->execute([$key, $value, $value]);
    } catch (Exception $e) {
        error_log("[METRICS] Counter increment failed: " . $e->getMessage());
    }
}

/**
 * Get latency statistics (P50, P95, P99) for an endpoint.
 */
function getLatencyStats($pdo, $endpoint, $minutes = 60)
{
    $stmt = $pdo->prepare("
        SELECT duration_ms FROM api_metrics 
        WHERE endpoint = ? AND created_at > NOW() - INTERVAL ? MINUTE
        ORDER BY duration_ms ASC
        LIMIT 5000
    ");
    $stmt->execute([$endpoint, $minutes]);
    $durations = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($durations)) {
        return ['p50' => 0, 'p95' => 0, 'p99' => 0, 'count' => 0];
    }

    $count = count($durations);
    return [
        'p50' => $durations[(int) floor($count * 0.50)] ?? 0,
        'p95' => $durations[(int) floor($count * 0.95)] ?? 0,
        'p99' => $durations[(int) floor($count * 0.99)] ?? 0,
        'count' => $count
    ];
}

/**
 * Get error stats for an endpoint.
 */
function getErrorStats($pdo, $endpoint, $minutes = 60)
{
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
        FROM api_metrics 
        WHERE endpoint = ? AND created_at > NOW() - INTERVAL ? MINUTE
    ");
    $stmt->execute([$endpoint, $minutes]);
    $row = $stmt->fetch();

    $total = (int) ($row['total'] ?? 0);
    $errors = (int) ($row['errors'] ?? 0);

    return [
        'total' => $total,
        'errors' => $errors,
        'error_rate' => $total > 0 ? round($errors / $total, 4) : 0
    ];
}

/**
 * Get throughput for an endpoint.
 */
function getThroughputStats($pdo, $endpoint, $minutes = 60)
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count FROM api_metrics 
        WHERE endpoint = ? AND created_at > NOW() - INTERVAL ? MINUTE
    ");
    $stmt->execute([$endpoint, $minutes]);
    return (int) $stmt->fetchColumn();
}

/**
 * Get all system counters.
 */
function getCounters($pdo)
{
    $stmt = $pdo->query("SELECT metric_key, metric_value FROM system_counters");
    $counters = [];
    while ($row = $stmt->fetch()) {
        $counters[$row['metric_key']] = (int) $row['metric_value'];
    }
    return $counters;
}
