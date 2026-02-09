<?php
// cron/governance_cleanup.php
// Epic 58: Expire Stale Requests

require_once __DIR__ . '/../includes/db_connect.php';

echo "Running Governance Cleanup...\n";

// HF-58.3: 7-Day Expiry
$threshold = date('Y-m-d H:i:s', strtotime("-7 days"));
$stmt = $pdo->prepare("UPDATE admin_action_queue SET status = 'EXPIRED' WHERE status = 'PENDING' AND created_at < ?");
$stmt->execute([$threshold]);
$count = $stmt->rowCount();

if ($count > 0) {
    echo "Expired $count stale requests.\n";
} else {
    echo "No requests to expire.\n";
}
