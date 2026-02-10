<?php
// run_migration_015.php
require_once __DIR__ . '/includes/db_connect.php';

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Running migration 015_receipts.sql...\n";

    $sql = file_get_contents(__DIR__ . '/migrations/015_receipts.sql');

    // Execute
    $pdo->exec($sql);

    echo "Migration 015 successful!\n";

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
