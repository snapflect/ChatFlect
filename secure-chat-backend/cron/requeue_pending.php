<?php
// cron/requeue_pending.php
// Epic 49: Resilience - Requeue Stuck Messages

require_once __DIR__ . '/../includes/db_connect.php';

echo "Starting Message Re-queue Manager...\n";

// 1. Identify stuck messages (PENDING > 24 hours?)
// If push failed, maybe we retry.
// Logic: If PENDING > 1 hour, maybe emit another push event?

// For now, let's just log stats. Real push retry logic requires push_queue table.

$stmt = $pdo->query("SELECT COUNT(*) FROM device_inbox WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL 1 HOUR");
$stuckCount = $stmt->fetchColumn();

echo "Found $stuckCount messages pending > 1 hour.\n";

// Future: Re-trigger FCM/APNS here.

echo "Re-queue Check Complete.\n";
