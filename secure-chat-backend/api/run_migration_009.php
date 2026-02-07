<?php
/**
 * Migration Runner: 009_message_ordering.sql
 * Epic 13: Ordering Guarantees (Logical Clock Engine)
 *
 * Run this script to apply the message ordering migration.
 *
 * Usage: php run_migration_009.php
 */

require_once 'db_connect.php';

echo "=== Migration 009: Message Ordering ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

// Read migration file
$migrationFile = __DIR__ . '/../migrations/009_message_ordering.sql';
if (!file_exists($migrationFile)) {
    die("ERROR: Migration file not found: $migrationFile\n");
}

$sql = file_get_contents($migrationFile);

// Split by semicolon (but not inside DELIMITER blocks)
$statements = [];
$inDelimiter = false;
$currentStmt = '';

foreach (explode("\n", $sql) as $line) {
    $trimmed = trim($line);

    if (strpos($trimmed, 'DELIMITER //') === 0) {
        $inDelimiter = true;
        continue;
    }
    if (strpos($trimmed, 'DELIMITER ;') === 0) {
        $inDelimiter = false;
        if (!empty(trim($currentStmt))) {
            $statements[] = trim($currentStmt);
        }
        $currentStmt = '';
        continue;
    }

    if ($inDelimiter) {
        if (strpos($trimmed, '//') !== false && strpos($trimmed, 'END //') !== false) {
            $currentStmt .= str_replace(' //', '', $line) . "\n";
            $statements[] = trim($currentStmt);
            $currentStmt = '';
        } else {
            $currentStmt .= $line . "\n";
        }
    } else {
        $currentStmt .= $line . "\n";
        if (substr($trimmed, -1) === ';') {
            $statements[] = trim($currentStmt);
            $currentStmt = '';
        }
    }
}

// Filter empty and comment-only statements
$statements = array_filter($statements, function ($stmt) {
    $clean = trim(preg_replace('/--.*$/m', '', $stmt));
    return !empty($clean) && $clean !== ';';
});

echo "Found " . count($statements) . " SQL statements to execute.\n\n";

$success = 0;
$failed = 0;
$skipped = 0;

foreach ($statements as $i => $stmt) {
    $num = $i + 1;
    $preview = substr(preg_replace('/\s+/', ' ', $stmt), 0, 60);
    echo "[$num] $preview...\n";

    try {
        if ($conn->query($stmt)) {
            echo "    ✓ Success\n";
            $success++;
        } else {
            $error = $conn->error;
            // Handle already exists gracefully
            if (
                strpos($error, 'already exists') !== false ||
                strpos($error, 'Duplicate') !== false
            ) {
                echo "    ~ Skipped (already exists)\n";
                $skipped++;
            } else {
                echo "    ✗ Failed: $error\n";
                $failed++;
            }
        }
    } catch (Exception $e) {
        $msg = $e->getMessage();
        if (strpos($msg, 'already exists') !== false) {
            echo "    ~ Skipped (already exists)\n";
            $skipped++;
        } else {
            echo "    ✗ Error: $msg\n";
            $failed++;
        }
    }
}

echo "\n=== Migration Complete ===\n";
echo "Success: $success\n";
echo "Skipped: $skipped\n";
echo "Failed: $failed\n";

// Verify table exists
$result = $conn->query("SHOW TABLES LIKE 'chat_sequences'");
if ($result && $result->num_rows > 0) {
    echo "\n✓ Table 'chat_sequences' verified.\n";
} else {
    echo "\n✗ Table 'chat_sequences' NOT FOUND!\n";
}

// Check messages columns
$desc = $conn->query("DESCRIBE messages");
if ($desc) {
    $hasServerSeq = false;
    while ($row = $desc->fetch_assoc()) {
        if ($row['Field'] === 'server_seq') {
            $hasServerSeq = true;
            break;
        }
    }
    echo $hasServerSeq
        ? "✓ Column 'server_seq' exists in messages table.\n"
        : "✗ Column 'server_seq' NOT FOUND in messages table!\n";
}

$conn->close();
echo "\nDone.\n";
