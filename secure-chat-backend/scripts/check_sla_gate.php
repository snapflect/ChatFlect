<?php
/**
 * scripts/check_sla_gate.php
 * Epic 32: CI Release Gate - SLA Regression Blocker
 * 
 * Usage: php scripts/check_sla_gate.php
 * Env: API_URL, ADMIN_API_TOKEN
 */

$apiUrl = getenv('API_URL') ?: 'http://localhost/secure-chat-backend';
$adminToken = getenv('ADMIN_API_TOKEN') ?: 'CHANGE_ME_IN_PRODUCTION';

echo "=== SLA Gate Check ===\n";
echo "API URL: $apiUrl\n\n";

// Call health_report.php
$healthUrl = rtrim($apiUrl, '/') . '/admin/v1/health_report.php';

$ch = curl_init($healthUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "X-Admin-Token: $adminToken",
        "X-Admin-Id: ci-sla-gate",
        "Content-Type: application/json"
    ],
    CURLOPT_TIMEOUT => 30
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    echo "❌ FAIL: Connection error - $error\n";
    exit(1);
}

if ($httpCode !== 200) {
    echo "❌ FAIL: HTTP $httpCode - API not reachable\n";
    exit(1);
}

$data = json_decode($response, true);
if (!$data) {
    echo "❌ FAIL: Invalid JSON response\n";
    exit(1);
}

// Check status
$status = $data['status'] ?? 'UNKNOWN';
$slaStatus = $data['sla_status'] ?? $status;
$alerts = $data['alerts'] ?? [];

echo "Status: $status\n";
echo "SLA Status: $slaStatus\n";
echo "Alerts: " . count($alerts) . "\n\n";

// Metrics Summary
echo "--- Metrics ---\n";
echo "Send P95: " . ($data['relay_send_p95'] ?? 0) . "ms\n";
echo "Send P99: " . ($data['relay_send_p99'] ?? 0) . "ms\n";
echo "Pull P99: " . ($data['relay_pull_p99'] ?? 0) . "ms\n";
echo "Error Rate: " . round(($data['error_rate_5xx'] ?? 0) * 100, 2) . "%\n";
echo "DB Status: " . ($data['db_status'] ?? 'UNKNOWN') . "\n\n";

// Show alerts
if (!empty($alerts)) {
    echo "--- Active Alerts ---\n";
    foreach ($alerts as $alert) {
        echo "⚠️  {$alert['type']}: {$alert['value']} > {$alert['threshold']}\n";
    }
    echo "\n";
}

// Gate decision
if ($status === 'CRITICAL') {
    echo "❌ FAIL: SLA CRITICAL\n";
    echo "PR merge blocked due to critical SLA violation.\n";
    exit(1);
}

if ($status === 'DEGRADED') {
    echo "❌ FAIL: SLA DEGRADED\n";
    echo "PR merge blocked due to SLA regression.\n";
    exit(1);
}

// Check specific thresholds
$sendP99 = $data['relay_send_p99'] ?? 0;
$errorRate = $data['error_rate_5xx'] ?? 0;

if ($sendP99 > 350) {
    echo "❌ FAIL: send_p99={$sendP99}ms > 350ms threshold\n";
    exit(1);
}

if ($errorRate > 0.01) {
    $pct = round($errorRate * 100, 2);
    echo "❌ FAIL: error_rate={$pct}% > 1% threshold\n";
    exit(1);
}

echo "✅ PASS: SLA OK\n";
echo "All metrics within acceptable thresholds.\n";
exit(0);
