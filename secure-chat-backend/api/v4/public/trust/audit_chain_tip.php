<?php
// api/v4/public/trust/audit_chain_tip.php
// Epic 59: Audit Chain Tip
// Returns the HEAD of the immutable audit log hash chain.

require_once __DIR__ . '/../../../../includes/db_connect.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache'); // Real-time tip

// Fetch latest audit log
$stmt = $pdo->query("SELECT log_id, created_at, row_hash, previous_hash FROM audit_logs ORDER BY log_id DESC LIMIT 1");
$tip = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$tip) {
    echo json_encode(['status' => 'empty']);
} else {
    echo json_encode([
        'status' => 'active',
        'tip' => [
            'height' => $tip['log_id'],
            'hash' => $tip['row_hash'],
            'timestamp' => $tip['created_at']
        ]
    ]);
}
