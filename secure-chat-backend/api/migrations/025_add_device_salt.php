<?php
/**
 * Migration 025: Add ZK-S Device Salt
 * Resolves 500 error in auth_salt.php
 */
require_once __DIR__ . '/../db.php';

header('Content-Type: text/plain');

echo "Starting Migration 025...\n";

global $conn;

// 1. Check if column exists
$res = $conn->query("SHOW COLUMNS FROM user_devices LIKE 'salt'");
if ($res->num_rows === 0) {
    echo "Adding 'salt' column to user_devices...\n";
    if ($conn->query("ALTER TABLE user_devices ADD COLUMN salt VARCHAR(255) DEFAULT NULL AFTER status")) {
        echo "SUCCESS: Column added.\n";
    } else {
        echo "ERROR: " . $conn->error . "\n";
    }
} else {
    echo "SKIP: Column 'salt' already exists.\n";
}

echo "Migration Complete.\n";
?>