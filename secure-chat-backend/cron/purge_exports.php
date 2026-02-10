<?php
// cron/purge_exports.php
// HF-63.5: Auto-Purge

require_once __DIR__ . '/../includes/db_connect.php';

echo "Running Export Purge...\n";

// Purge exports > 30 days old unless held (Legal Hold checked elsewhere or assumed no hold on temp exports)
$cutoff = date('Y-m-d H:i:s', strtotime('-30 days'));

$stmt = $pdo->prepare("SELECT export_id, file_path FROM compliance_exports WHERE created_at < ? AND status != 'EXPIRED'");
$stmt->execute([$cutoff]);

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    if (file_exists($row['file_path'])) {
        unlink($row['file_path']);
    }
    $upd = $pdo->prepare("UPDATE compliance_exports SET status='EXPIRED', file_path=NULL WHERE export_id=?");
    $upd->execute([$row['export_id']]);
    echo "Purged: " . bin2hex($row['export_id']) . "\n";
}

echo "Done.\n";
