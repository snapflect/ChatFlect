<?php
// cron/vuln_cleanup.php
// Epic 57: File Auto-Purge
// Deletes vulnerability attachments older than 30 days.

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/audit_logger.php';

echo "Running Vulnerability Attachment Cleanup...\n";

$logger = new AuditLogger($pdo);
$days = 30;
$threshold = date('Y-m-d H:i:s', strtotime("- $days days"));

// 1. Find Old Attachments
$stmt = $pdo->prepare("SELECT attachment_id, filename_storage FROM vulnerability_attachments WHERE uploaded_at < ?");
$stmt->execute([$threshold]);
$files = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($files) > 0) {
    echo "Found " . count($files) . " old attachments to purge.\n";
    $storageDir = __DIR__ . '/../storage/vuln_uploads';
    $deletedCount = 0;

    foreach ($files as $f) {
        $path = $storageDir . '/' . $f['filename_storage'];
        if (file_exists($path)) {
            unlink($path);
        }

        // Delete DB record
        $del = $pdo->prepare("DELETE FROM vulnerability_attachments WHERE attachment_id = ?");
        $del->execute([$f['attachment_id']]);

        $deletedCount++;
    }

    $logger->log('VULN_PURGE', 'INFO', ['deleted_count' => $deletedCount, 'threshold' => $threshold]);
    echo "Purged $deletedCount attachments.\n";
} else {
    echo "No cleanup needed.\n";
}
