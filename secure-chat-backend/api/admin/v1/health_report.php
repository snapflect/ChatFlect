<?php
// api/admin/v1/health_report.php
// Epic 30 + 31: Health Report with SLA Evaluation

require_once __DIR__ . '/../../../includes/admin_auth.php';
require_once __DIR__ . '/../../../includes/metrics.php';
require_once __DIR__ . '/../../../includes/kill_switch.php';
require_once __DIR__ . '/../../../includes/alert_rules.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    // Epic 31: Run SLA Evaluation
    $slaResult = evaluateSystemHealth($pdo, 60);

    // DB Health Check
    $dbStatus = 'OK';
    try {
        $pdo->query("SELECT 1");
    } catch (Exception $e) {
        $dbStatus = 'CRITICAL';
    }

    // Kill Switch Status
    $killSwitches = getKillSwitchStatus();

    // Counters
    $counters = getCounters($pdo);

    // Override status if critical conditions
    $status = $slaResult['status'];
    if ($dbStatus !== 'OK' || in_array(true, $killSwitches)) {
        $status = 'CRITICAL';
    }

    echo json_encode([
        'success' => true,
        'status' => $status,
        'sla_status' => $slaResult['status'],
        'alerts' => $slaResult['alerts'],
        'relay_send_p50' => $slaResult['metrics']['send_p95'] ?? 0,
        'relay_send_p95' => $slaResult['metrics']['send_p95'] ?? 0,
        'relay_send_p99' => $slaResult['metrics']['send_p99'] ?? 0,
        'relay_pull_p99' => $slaResult['metrics']['pull_p99'] ?? 0,
        'error_rate_5xx' => $slaResult['metrics']['error_rate'] ?? 0,
        'rate_limit_blocks_total' => $counters['rate_limit_blocks_total'] ?? 0,
        'abuse_locks_active' => $slaResult['metrics']['abuse_locks'] ?? 0,
        'db_status' => $dbStatus,
        'kill_switches' => $killSwitches,
        'request_id' => RequestContext::getRequestId()
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}

