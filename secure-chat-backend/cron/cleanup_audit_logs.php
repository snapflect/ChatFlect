<?php
// cron/cleanup_audit_logs.php
// Epic 51 HF: Log Retention Enforcement
// Runs Daily.

require_once __DIR__ . '/../includes/db_connect.php';

echo "Starting Audit Log Cleanup...\n";

// HF-51.7: Privileged Cleanup Bypass
$pdo->exec("SET @allow_audit_cleanup = 1");

// 1. Purge INFO logs older than 30 days
$stmt = $pdo->prepare("DELETE FROM security_audit_log WHERE severity = 'INFO' AND created_at < NOW() - INTERVAL 30 DAY");

$stmt->execute();
$infoDeleted = $stmt->rowCount();
echo "[CLEANUP] Deleted $infoDeleted INFO logs > 30 days.\n";

// 2. Purge WARNING logs older than 90 days
$stmt = $pdo->prepare("DELETE FROM security_audit_log WHERE severity = 'WARNING' AND created_at < NOW() - INTERVAL 90 DAY");
$stmt->execute();
$warningDeleted = $stmt->rowCount();
echo "[CLEANUP] Deleted $warningDeleted WARNING logs > 90 days.\n";

// 3. Purge CRITICAL logs older than 1 year (Compliance requires 1 year usually)
$stmt = $pdo->prepare("DELETE FROM security_audit_log WHERE severity = 'CRITICAL' AND created_at < NOW() - INTERVAL 1 YEAR");
$stmt->execute();
$criticalDeleted = $stmt->rowCount();
echo "[CLEANUP] Deleted $criticalDeleted CRITICAL logs > 1 year.\n";

echo "Audit Cleanup Complete.\n";
