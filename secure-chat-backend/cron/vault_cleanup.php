<?php
// cron/vault_cleanup.php
// Epic 69: Secure Delete Audit

require_once __DIR__ . '/../includes/db_connect.php';

echo "Running Vault Cleanup...\n";

// In a real system, secure delete might involve identifying "marked for deletion" rows and overwriting them.
// Since we use DELETE CASCADE, rows are gone from DB.
// This cron can look for "Orphaned Keys" (keys with no items) and delete them if inactive?
// OR just verify integrity.

// Let's implement an "Orphan Key Sweeper"
// Delete inactive keys that have 0 items.
$sql = "
    DELETE k FROM vault_keys k
    LEFT JOIN vault_items i ON k.key_id = i.key_id
    WHERE i.item_id IS NULL AND k.is_active = 0
    AND k.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
";
$cnt = $pdo->exec($sql);

echo "Cleaned up $cnt orphaned vault keys.\n";
