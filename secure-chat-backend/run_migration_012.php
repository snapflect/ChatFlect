<?php
/**
 * Migration Runner: 012_relay_messages.php
 */
require_once 'api/db_connect.php';

echo "=== Migration 012: Relay Messages Table ===\n";
$sql = file_get_contents('migrations/012_relay_messages.sql');

if ($conn->multi_query($sql)) {
    do {
        // flush
    } while ($conn->next_result());
    echo "✓ Table 'messages' created/verified.\n";
} else {
    echo "✗ Error: " . $conn->error . "\n";
}

$conn->close();
echo "Done.\n";
