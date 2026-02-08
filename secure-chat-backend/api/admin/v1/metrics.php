<?php
// api/admin/v1/metrics.php
// Epic 29: Admin Metrics Dashboard API

require_once __DIR__ . '/../../../includes/admin_auth.php';
require_once __DIR__ . '/../../../includes/metrics.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    $minutes = isset($_GET['minutes']) ? (int) $_GET['minutes'] : 60;
    $minutes = min(max($minutes, 5), 1440); // 5 min to 24 hours

    // Key endpoints to track
    $endpoints = [
        '/relay/send.php',
        '/relay/pull.php',
        '/relay/receipt.php',
        '/presence/update.php'
    ];

    // 1. Latency Stats (P50/P95/P99)
    $latency = [];
    foreach ($endpoints as $ep) {
        $latency[$ep] = getLatencyStats($pdo, $ep, $minutes);
    }

    // 2. Error Stats
    $errors = [];
    foreach ($endpoints as $ep) {
        $errors[$ep] = getErrorStats($pdo, $ep, $minutes);
    }

    // 3. System Counters
    $counters = getCounters($pdo);

    // 4. Recent Activity (last 24h summary)
    $stmt = $pdo->query("
        SELECT 
            COUNT(*) as total_requests,
            SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as total_errors,
            AVG(duration_ms) as avg_latency_ms
        FROM api_metrics 
        WHERE created_at > NOW() - INTERVAL 24 HOUR
    ");
    $summary = $stmt->fetch();

    echo json_encode([
        'success' => true,
        'window_minutes' => $minutes,
        'latency' => $latency,
        'errors' => $errors,
        'counters' => $counters,
        'summary_24h' => [
            'total_requests' => (int) ($summary['total_requests'] ?? 0),
            'total_errors' => (int) ($summary['total_errors'] ?? 0),
            'avg_latency_ms' => round($summary['avg_latency_ms'] ?? 0, 2)
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
