<?php
// cron/media_cleanup.php
// Delete expired attachments

require_once __DIR__ . '/../includes/db_connect.php';

// Delete files expired > 24 hours ago
$stmt = $pdo->prepare("SELECT attachment_id FROM attachments WHERE expires_at < NOW() - INTERVAL 1 DAY");
$stmt->execute();

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $id = bin2hex($row['attachment_id']);
    $path = __DIR__ . '/../uploads/' . $id . '.bin';
    if (file_exists($path)) {
        unlink($path);
    }
    // Delete validation db entry
    $del = $pdo->prepare("DELETE FROM attachments WHERE attachment_id = ?");
    $del->execute([$row['attachment_id']]);
    echo "Deleted: $id\n";
}
