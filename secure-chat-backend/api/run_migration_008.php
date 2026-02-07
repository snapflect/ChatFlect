<?php
/**
 * Migration Runner: 008_message_idempotency.sql
 * Epic 12: Idempotency + Deduplication Layer
 *
 * Run this script to apply the message idempotency table migration.
 *
 * Usage: php run_migration_008.php
 */

require_once 'db_connect.php';

echo "=== Migration 008: Message Idempotency ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

// Read migration file
$migrationFile = __DIR__ . '/../migrations/008_message_idempotency.sql';
if (!file_exists($migrationFile)) {
    die("ERROR: Migration file not found: $migrationFile\n");
}

$sql = file_get_contents($migrationFile);

// Split by semicolon to execute statements individually
$statements = array_filter(
    array_map('trim', explode(';', $sql)),
    function ($stmt) {
        // Filter out empty statements and comments
        return !empty($stmt) && strpos($stmt, '--') !== 0;
    }
);

echo "Found " . count($statements) . " SQL statements to execute.\n\n";

$success = 0;
$failed = 0;

foreach ($statements as $i => $stmt) {
    $num = $i + 1;
    echo "[$num] Executing...\n";

    // Skip comment-only blocks
    if (preg_match('/^--/', trim($stmt))) {
        echo "    Skipped (comment)\n";
        continue;
    }

    try {
        if ($conn->query($stmt)) {
            echo "    ✓ Success\n";
            $success++;
        } else {
            echo "    ✗ Failed: " . $conn->error . "\n";
            $failed++;
        }
    } catch (Exception $e) {
        // Handle "already exists" errors gracefully
        if (
            strpos($e->getMessage(), 'already exists') !== false ||
            strpos($conn->error, 'Duplicate') !== false
        ) {
            echo "    ~ Skipped (already exists)\n";
            $success++;
        } else {
            echo "    ✗ Error: " . $e->getMessage() . "\n";
            $failed++;
        }
    }
}

echo "\n=== Migration Complete ===\n";
echo "Success: $success\n";
echo "Failed: $failed\n";

// Verify table exists
$result = $conn->query("SHOW TABLES LIKE 'message_idempotency'");
if ($result && $result->num_rows > 0) {
    echo "\n✓ Table 'message_idempotency' verified.\n";

    // Show table structure
    $desc = $conn->query("DESCRIBE message_idempotency");
    if ($desc) {
        echo "\nTable Structure:\n";
        while ($row = $desc->fetch_assoc()) {
            echo "  - {$row['Field']}: {$row['Type']}\n";
        }
    }
} else {
    echo "\n✗ Table 'message_idempotency' NOT FOUND!\n";
}

$conn->close();
echo "\nDone.\n";
