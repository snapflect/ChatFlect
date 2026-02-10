<?php
// run_migration_016.php
require_once __DIR__ . '/includes/db_connect.php';

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Running migration 016_performance_indexes.sql...\n";

    $sql = file_get_contents(__DIR__ . '/migrations/016_performance_indexes.sql');

    // Execute multiple statements? 
    // PDO::exec executes one statement usually.
    // We have 2 statements.

    $statements = explode(';', $sql);
    foreach ($statements as $stmt) {
        $stmt = trim($stmt);
        if (!empty($stmt)) {
            try {
                $pdo->exec($stmt);
                echo "Executed: " . substr($stmt, 0, 50) . "...\n";
            } catch (Exception $e) {
                // Ignore "Key name already exists" or "Duplicate key"
                if (strpos($e->getMessage(), 'Duplicate key') !== false || strpos($e->getMessage(), 'already exists') !== false) {
                    echo "Index already exists, skipping.\n";
                } else {
                    throw $e;
                }
            }
        }
    }

    echo "Migration 016 successful!\n";

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
