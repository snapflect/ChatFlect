<?php
// api/v4/public/trust/proofs.php
// Epic 59: Proof Aggregator
// A "Daily Heartbeat" of all system integrity roots.

require_once __DIR__ . '/../../../../includes/db_connect.php';

// HF-59.2: Cache Optimization
header('Content-Type: application/json');
header('Cache-Control: public, max-age=3600');
header('ETag: "' . md5(date('Y-m-d H')) . '"'); // Change hourly

// 1. Audit Tip
$stmtAudit = $pdo->query("SELECT row_hash FROM audit_logs ORDER BY log_id DESC LIMIT 1");
$auditTip = $stmtAudit->fetchColumn();

// 2. Latest Transparency Report Sig
$stmtTR = $pdo->query("SELECT signature FROM transparency_reports ORDER BY period_end DESC LIMIT 1");
$trSig = $stmtTR->fetchColumn();

// 3. Latest Governance Action Sig
$stmtGov = $pdo->query("SELECT action_hash FROM admin_action_queue WHERE status='EXECUTED' ORDER BY request_id DESC LIMIT 1");
$govHash = $stmtGov->fetchColumn();

$payload = [
    'generated_at' => date('c'),
    'integrity_roots' => [
        'audit_log' => $auditTip,
        'transparency_report' => hash('sha256', $trSig ?? ''),
        'governance_latest' => $govHash
    ]
];

// HF-59.1: Digital Signature
$json = json_encode($payload, JSON_PRETTY_PRINT);
$privateKeyPath = __DIR__ . '/../../../../keys/server_private.pem';
if (file_exists($privateKeyPath)) {
    $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
    openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
    $payload['_signature'] = base64_encode($signature);
} else {
    $payload['_signature'] = 'DEV_MODE_UNSIGNED';
}

echo json_encode($payload, JSON_PRETTY_PRINT);
