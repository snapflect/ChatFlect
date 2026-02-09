<?php
// cron/vuln_sla_monitor.php
// Epic 57: SLA Monitor for Vulnerability Reports
// Alerts if NEW reports are ignored for > 48h.

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/audit_logger.php';

echo "Running Vulnerability SLA Monitor...\n";

$logger = new AuditLogger($pdo);
$slaHours = 48;
$threshold = date('Y-m-d H:i:s', strtotime("- $slaHours hours"));

// 1. Check Stale NEW Reports
$stmt = $pdo->prepare("SELECT report_id, created_at FROM vulnerability_reports WHERE status = 'NEW' AND created_at < ?");
$stmt->execute([$threshold]);
$staleReports = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($staleReports) > 0) {
    echo "Found " . count($staleReports) . " stale reports.\n";
    foreach ($staleReports as $r) {
        $logger->log('SLA_VIOLATION', 'CRITICAL', [
            'entity' => 'VULN_REPORT',
            'id' => $r['report_id'],
            'age_hours' => $slaHours
        ]);
        echo "Alerted on Report ID " . $r['report_id'] . "\n";
    }
} else {
    echo "No SLA violations found.\n";
}
