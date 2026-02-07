<?php
// cron/cleanup_presence.php
// Run this every minute via crontab

require_once __DIR__ . '/../includes/db_connect.php';

try {
    // 1. Mark users offline if last_seen > 2 minutes ago
    // Actually, our query.php does this calculation dynamically.
    // But we might want to update the DB state for consistency or analytics.
    // Let's just update the status column to 'offline' for stale records.

    $stmt = $pdo->prepare("
        UPDATE presence 
        SET status = 'offline', typing_in_chat = NULL 
        WHERE last_seen < NOW() - INTERVAL 2 MINUTE 
        AND status != 'offline'
    ");
    $stmt->execute();
    $count = $stmt->rowCount();

    if ($count > 0) {
        echo "Marked $count users offline.\n";
    }

    // 2. Typing Cleanup (Redundant if client sends clear, but good safety)
    // If typing logic is separate, we can clear typing_in_chat if > 30s old?
    // PresenceService sends typing every 10s. So 30s is safe buffer.

    $stmt = $pdo->prepare("
        UPDATE presence 
        SET typing_in_chat = NULL 
        WHERE last_seen < NOW() - INTERVAL 30 SECOND 
        AND typing_in_chat IS NOT NULL
    ");
    $stmt->execute();

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
