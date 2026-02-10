<?php
// cron/requeue_pending.php
// Epic 49: Resilience - Requeue Stuck Messages

require_once __DIR__ . '/../includes/db_connect.php';

echo "Starting Message Re-queue Manager...\n";

// 1. Identify stuck messages (PENDING > 24 hours?)
// If push failed, maybe we retry.
// Logic: If PENDING > 1 hour, maybe emit another push event?

// HF-49.7: Active Requeue & Failure Marking
// 1. Mark as FAILED if retry_count > 5
$pdo->exec("UPDATE device_inbox SET status = 'FAILED' WHERE status = 'PENDING' AND retry_count > 5");

// 2. Increment retry for stuck messages
$stmt = $pdo->query("
    UPDATE device_inbox 
    SET retry_count = retry_count + 1, last_retry_at = NOW()
    WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL 1 HOUR AND retry_count <= 5
");
// Note: In a real system, we would fetch these rows and re-emit a Push Notification event here.
// For now, we just track the retry state.

$stuckCount = $stmt->rowCount();
echo "Re-queued (metadata update) $stuckCount stuck messages.\n";

echo "Re-queue Check Complete.\n";
