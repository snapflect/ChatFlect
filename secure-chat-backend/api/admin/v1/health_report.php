<?php
// api/admin/v1/health_report.php
// Epic 30: Automated Incident Detection Signals

require_once __DIR__ . '/../../../includes/admin_auth.php';
require_once __DIR__ . '/../../../includes/metrics.php';
require_once __DIR__ . '/../../../includes/kill_switch.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    // 1. Latency Stats (last 60 min)
    $sendLatency = getLatencyStats($pdo, '/relay/send.php', 60);
    $pullLatency = getLatencyStats($pdo, '/relay/pull.php', 60);

    // 2. Error Rates
    $sendErrors = getErrorStats($pdo, '/relay/send.php', 60);

    // 3. Counters
    $counters = getCounters($pdo);

    // 4. DB Health Check
    $dbStatus = 'OK';
    try {
        $pdo->query("SELECT 1");
    } catch (Exception $e) {
        $dbStatus = 'CRITICAL';
    }

    // 5. Active Abuse Locks
    $stmt = $pdo->query("SELECT COUNT(*) FROM abuse_scores WHERE cooldown_until > NOW()");
    $abuseLocks = (int) $stmt->fetchColumn();

    // 6. Kill Switch Status
    $killSwitches = getKillSwitchStatus();

    // 7. Determine Overall Status
    $status = 'OK';
    if ($sendLatency['p99'] > 500 || $sendErrors['error_rate'] > 0.05) {
        $status = 'DEGRADED';
    }
    if ($dbStatus !== 'OK' || $sendErrors['error_rate'] > 0.1 || in_array(true, $killSwitches)) {
        $status = 'CRITICAL';
    }

    echo json_encode([
        'success' => true,
        'status' => $status,
        'relay_send_p50' => $sendLatency['p50'],
        'relay_send_p95' => $sendLatency['p95'],
        'relay_send_p99' => $sendLatency['p99'],
        'relay_pull_p99' => $pullLatency['p99'],
        'error_rate_5xx' => $sendErrors['error_rate'],
        'rate_limit_blocks_total' => $counters['rate_limit_blocks_total'] ?? 0,
        'abuse_locks_active' => $abuseLocks,
        'db_status' => $dbStatus,
        'kill_switches' => $killSwitches,
        'request_id' => RequestContext::getRequestId()
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
