<?php
// api/v4/public/trust/proof_history.php
// Epic 59 HF: Proof History
// Returns the "Daily Tip" of the audit log for the last 30 days.

require_once __DIR__ . '/../../../../includes/db_connect.php';

header('Content-Type: application/json');
header('Cache-Control: public, max-age=3600');

// Fetch last 30 daily snapshots (simulated by querying audit logs at midnight intervals)
// Since we don't have a 'daily_proofs' table, we'll dynamically query the log nearest to midnight.
$history = [];
for ($i = 0; $i < 30; $i++) {
    $date = date('Y-m-d', strtotime("-$i days"));
    // Rough approximation: Last log of the day
    $stmt = $pdo->prepare("SELECT row_hash, created_at FROM audit_logs WHERE created_at LIKE ? ORDER BY log_id DESC LIMIT 1");
    $stmt->execute(["$date%"]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $history[] = [
            'date' => $date,
            'audit_tip_hash' => $row['row_hash'],
            'timestamp' => $row['created_at']
        ];
    }
}

echo json_encode(['proof_history' => $history], JSON_PRETTY_PRINT);
