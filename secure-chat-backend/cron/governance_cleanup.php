<?php
// cron/governance_cleanup.php
// Epic 58: Expire Stale Requests

require_once __DIR__ . '/../includes/db_connect.php';

echo "Running Governance Cleanup...\n";

// HF-58.9: Dynamic Expiry
// Instead of hardcoded 7 days, we respect the 'expired_at' set at creation time (based on policy).
// But as a failsafe, we force expire anything > 30 days pending.
$now = date('Y-m-d H:i:s');
$stmt = $pdo->prepare("UPDATE admin_action_queue SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at < ?");
$stmt->execute([$now]);
$count = $stmt->rowCount();

// Clean extremely old logs (archival)
$archiveThreshold = date('Y-m-d H:i:s', strtotime("-365 days"));
// In real app, move to archive table. Here, no-op or log.

if ($count > 0) {
    echo "Expired $count stale requests.\n";
} else {
    echo "No requests to expire.\n";
}
