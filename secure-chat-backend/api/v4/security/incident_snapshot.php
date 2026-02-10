<?php
// api/v4/security/incident_snapshot.php
// Epic 53: Full Actor Snapshot (Logs + Bans + Abuse Score)

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

// Admin Auth
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$targetType = $_GET['type'] ?? 'IP'; // IP, USER, DEVICE
$targetValue = $_GET['value'] ?? null;

if (!$targetValue) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_PARAMS']);
    exit;
}

$snapshot = [
    'generated_at' => date('c'),
    'actor' => [
        'type' => $targetType,
        'value' => $targetValue
    ]
];

// 1. Abuse Score
$stmtScore = $pdo->prepare("SELECT score, last_updated FROM abuse_scores WHERE target_key = ?");
$targetKey = md5("$targetType:$targetValue");
$stmtScore->execute([$targetKey]);
$snapshot['abuse_score'] = $stmtScore->fetch(PDO::FETCH_ASSOC);

// 2. Active Bans
$stmtBan = $pdo->prepare("SELECT * FROM ip_banlist WHERE target_type = ? AND target_value = ?");
$stmtBan->execute([$targetType, $targetValue]);
$snapshot['bans'] = $stmtBan->fetchAll(PDO::FETCH_ASSOC);

// 3. Recent Audit Logs (Last 100)
$col = ($targetType === 'USER') ? 'user_id' : (($targetType === 'DEVICE') ? 'device_id' : 'ip_address');
$stmtLogs = $pdo->prepare("SELECT * FROM security_audit_log WHERE $col = ? ORDER BY created_at DESC LIMIT 100");
$stmtLogs->execute([$targetValue]);
$snapshot['audit_logs'] = $stmtLogs->fetchAll(PDO::FETCH_ASSOC);

// HF-53.1: Snapshot Integrity Hash
// Compute SHA256 of the data payload to make it tamper-evident
$snapshot['integrity_hash'] = hash('sha256', json_encode($snapshot['actor']) . json_encode($snapshot['audit_logs']) . json_encode($snapshot['bans']));

echo json_encode(['success' => true, 'snapshot' => $snapshot]);

