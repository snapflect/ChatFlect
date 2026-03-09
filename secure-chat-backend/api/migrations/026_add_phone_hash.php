<?php
// 026_add_phone_hash.php
require_once 'db.php';

echo "Starting migration: 026_add_phone_hash\n";

// 1. Add phone_hash column
$sql = "ALTER TABLE users ADD COLUMN phone_hash CHAR(64) NULL AFTER phone_number";
if ($conn->query($sql) === TRUE) {
    echo "Column phone_hash added successfully.\n";
} else {
    echo "Error adding column: " . $conn->error . "\n";
}

// 2. Add Index
$sql = "CREATE INDEX idx_phone_hash ON users(phone_hash)";
if ($conn->query($sql) === TRUE) {
    echo "Index idx_phone_hash created successfully.\n";
} else {
    echo "Error creating index: " . $conn->error . "\n";
}

// 3. Backfill existing phone numbers
$result = $conn->query("SELECT user_id, phone_number FROM users WHERE phone_number IS NOT NULL AND phone_hash IS NULL");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $uid = $row['user_id'];
        $phone = $row['phone_number'];

        // Normalization (E164-ish logic in PHP)
        $clean = preg_replace('/\D/', '', $phone);
        // Simple logic: if doesn't start with country code, add it? 
        // Backend doesn't know country code here easily, so we just use digits.
        // Frontend will be the primary source of normalized 'phone' string.
        $hash = hash('sha256', $clean);

        $upd = $conn->prepare("UPDATE users SET phone_hash = ? WHERE user_id = ?");
        $upd->bind_param("ss", $hash, $uid);
        $upd->execute();
    }
    echo "Backfilled " . $result->num_rows . " user hashes.\n";
}

echo "Migration 026 finished.\n";
?>