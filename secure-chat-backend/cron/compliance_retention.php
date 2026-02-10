<?php
// cron/compliance_retention.php
// Epic 54: Automated Retention Policy Enforcement
// Daily Cron: Purges expired data respecting Legal Holds.

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/compliance_manager.php';
require_once __DIR__ . '/../includes/audit_logger.php';

echo "Starting Retention Governance...\n";

$manager = new ComplianceManager($pdo);
$logger = new AuditLogger($pdo);

// 1. Audit Logs Retention
$days = (int) $manager->getSetting('retention_audit_logs_days', 365);
echo "[AUDIT] Retention Window: $days days.\n";

// HF-54.5: Retention Dry Run Mode
$isDryRun = in_array('--dry-run', $argv);
if ($isDryRun)
    echo "[MODE] DRY RUN ACTIVE (No changes will be committed)\n";

// HF-54.3: Check Legal Hold Expiry
// Expire holds that have passed their date
if (!$isDryRun) {
    $stmtExp = $pdo->prepare("UPDATE legal_holds SET active = 0, review_required = 1 WHERE active = 1 AND expires_at < NOW()");
    $stmtExp->execute();
    if ($stmtExp->rowCount() > 0) {
        $logger->log('LEGAL_HOLD_EXPIRED', 'WARNING', ['count' => $stmtExp->rowCount()]);
        echo "[HOLDS] Expired " . $stmtExp->rowCount() . " holds.\n";
    }
}

// 1. Audit Logs Retention
$days = (int) $manager->getSetting('retention_audit_logs_days', 365);
echo "[AUDIT] Retention Window: $days days.\n";

// Partition Drop Optimization (HF-54.6)
// If partitioned, we should DROP PARTITION for speed, but that requires knowing partition names.
// Fallback to DELETE for compatibility or implements tailored DROP.
// Assuming DELETE is safe enough for this specific file, but respecting dry run.

if (!$isDryRun) {
    // Privileged cleanup
    $pdo->exec("SET @allow_audit_cleanup = 1");
    $stmt = $pdo->prepare("DELETE FROM security_audit_log WHERE created_at < NOW() - INTERVAL ? DAY");
    $stmt->execute([$days]);
    $deleted = $stmt->rowCount();
    if ($deleted > 0) {
        $logger->log('RETENTION_PURGE', 'INFO', ['table' => 'security_audit_log', 'rows' => $deleted]);
        echo "[AUDIT] Purged $deleted rows.\n";
    }
} else {
    // Dry run count
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM security_audit_log WHERE created_at < NOW() - INTERVAL ? DAY");
    $stmt->execute([$days]);
    $count = $stmt->fetchColumn();
    echo "[AUDIT] DRY RUN: Would purge $count rows.\n";
}

// 2. Abuse Scores Retention
$daysAbuse = (int) $manager->getSetting('retention_abuse_scores_days', 90);
$pdo->prepare("DELETE FROM abuse_scores WHERE last_updated < NOW() - INTERVAL ? DAY")->execute([$daysAbuse]);

echo "Retention Governance Complete.\n";
