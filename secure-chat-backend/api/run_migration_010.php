<?php
/**
 * Migration Runner: 010_repair_protocol.sql
 * Epic 14: Repair Protocol (Missing Message Recovery)
 *
 * This migration is purely to verify the environment is ready for repair protocol.
 * Since repair protocol mainly uses existing tables (messages) and client-side logic,
 * this script ensures indices are optimized for range queries.
 *
 * Usage: php run_migration_010.php
 */

require_once 'db_connect.php';

echo "=== Migration 010: Repair Protocol Checks ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

// 1. Check for server_seq index (critical for range queries)
$checkIndex = $conn->query("SHOW INDEX FROM messages WHERE Key_name = 'idx_messages_chat_seq'");
if ($checkIndex->num_rows > 0) {
    echo "✓ Index 'idx_messages_chat_seq' exists (good for repair range queries).\n";
} else {
    echo "⚠ Index 'idx_messages_chat_seq' MISSING. Creating...\n";
    try {
        $conn->query("CREATE INDEX idx_messages_chat_seq ON messages(chat_id, server_seq)");
        echo "  ✓ Index created successfully.\n";
    } catch (Exception $e) {
        echo "  ✗ Failed to create index: " . $e->getMessage() . "\n";
    }
}

// 2. Check for server_received_at column (for tamper verification)
$checkCol = $conn->query("SHOW COLUMNS FROM messages LIKE 'server_received_at'");
if ($checkCol->num_rows > 0) {
    echo "✓ Column 'server_received_at' exists.\n";
} else {
    echo "⚠ Column 'server_received_at' MISSING. Running Epic 13 migration is recommended.\n";
}

echo "\n=== Migration 010 Complete ===\n";
$conn->close();
echo "Done.\n";
