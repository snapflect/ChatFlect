<?php
// api/v4/public/trust/proofs.php
// Epic 59: Proof Aggregator
// A "Daily Heartbeat" of all system integrity roots.

require_once __DIR__ . '/../../../../includes/db_connect.php';

header('Content-Type: application/json');

// 1. Audit Tip
$stmtAudit = $pdo->query("SELECT row_hash FROM audit_logs ORDER BY log_id DESC LIMIT 1");
$auditTip = $stmtAudit->fetchColumn();

// 2. Latest Transparency Report Sig
$stmtTR = $pdo->query("SELECT signature FROM transparency_reports ORDER BY period_end DESC LIMIT 1");
$trSig = $stmtTR->fetchColumn();

// 3. Latest Governance Action Sig
// (We don't store sig in DB yet, usually generated on export. Let's return latest hash instead)
$stmtGov = $pdo->query("SELECT action_hash FROM admin_action_queue WHERE status='EXECUTED' ORDER BY request_id DESC LIMIT 1");
$govHash = $stmtGov->fetchColumn();

echo json_encode([
    'generated_at' => date('c'),
    'integrity_roots' => [
        'audit_log' => $auditTip,
        'transparency_report' => hash('sha256', $trSig ?? ''),
        'governance_latest' => $govHash
    ]
], JSON_PRETTY_PRINT);
