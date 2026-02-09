<?php
// cron/governance_cleanup.php
// Epic 58: Expire Stale Requests

require_once __DIR__ . '/../includes/db_connect.php';

echo "Running Governance Cleanup...\n";

$now = date('Y-m-d H:i:s');
$stmt = $pdo->prepare("UPDATE admin_action_queue SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at < ?");
$stmt->execute([$now]);
$count = $stmt->rowCount();

if ($count > 0) {
    echo "Expired $count stale requests.\n";
} else {
    echo "No requests to expire.\n";
}
