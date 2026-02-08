<?php
// cron/forensics_archive.php
// Epic 53: Daily Forensics Archive
// Archives yesterday's critical events to JSON file for retention.

require_once __DIR__ . '/../includes/db_connect.php';

echo "Starting Forensics Archive...\n";

$yesterday = date('Y-m-d', strtotime('-1 day'));
$archiveDir = __DIR__ . '/../archives/forensics';
if (!is_dir($archiveDir))
    mkdir($archiveDir, 0750, true);

$outputFile = "$archiveDir/critical_events_$yesterday.json.gz";

$stmt = $pdo->prepare("
    SELECT * FROM security_audit_log 
    WHERE severity IN ('CRITICAL', 'BLOCKER') 
    AND DATE(created_at) = ?
");
$stmt->execute([$yesterday]);
$events = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($events) > 0) {
    $gz = gzopen($outputFile, 'w9');
    gzwrite($gz, json_encode($events));
    gzclose($gz);
    echo "[ARCHIVE] Saved " . count($events) . " critical events to $outputFile\n";
} else {
    echo "[ARCHIVE] No critical events found for $yesterday.\n";
}
