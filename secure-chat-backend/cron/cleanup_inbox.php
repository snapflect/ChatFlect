<?php
// cron/cleanup_inbox.php
// Epic 48-HF: Inbox Cleanup Job

require_once __DIR__ . '/../includes/db_connect.php';

echo "Starting Inbox Cleanup...\n";

try {
    // Delete expired messages
    $stmt = $pdo->prepare("DELETE FROM device_inbox WHERE expires_at < ?");
    $stmt->execute([time()]);

    $deleted = $stmt->rowCount();
    echo "Deleted $deleted expired inbox messages.\n";

    // Optional: Soft cleanup of orphan rows (e.g., deleted devices)
    // $pdo->exec("DELETE FROM device_inbox WHERE recipient_device_id NOT IN (SELECT device_id FROM devices)");

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Cleanup Complete.\n";
