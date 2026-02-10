<?php
/**
 * Migration Runner: 011_message_receipts.sql
 */
require_once 'db_connect.php';

echo "=== Migration 011: Message Receipts ===\n";
$sql = file_get_contents('../migrations/011_message_receipts.sql');

if ($conn->multi_query($sql)) {
    do {
        // flush multi_queries
    } while ($conn->next_result());
    echo "✓ Table 'message_receipts' created/verified.\n";
} else {
    echo "✗ Error: " . $conn->error . "\n";
}

$conn->close();
echo "Done.\n";
