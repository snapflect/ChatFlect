<?php
require 'db.php';

// 1. Create OTPs Table
$sql = "CREATE TABLE IF NOT EXISTS otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    INDEX (phone_number)
)";

if ($conn->query($sql) === TRUE) {
    echo "Table 'otps' created successfully.<br>";
} else {
    echo "Error creating table 'otps': " . $conn->error . "<br>";
}

// 2. Add Email Column to Users (if not exists)
// MySQL doesn't have IF NOT EXISTS for columns easily in one line without procedure, 
// so we try and ignore error or check first.
$check = $conn->query("SHOW COLUMNS FROM users LIKE 'email'");
if ($check->num_rows == 0) {
    $sql2 = "ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER phone_number";
    if ($conn->query($sql2) === TRUE) {
        echo "Column 'email' added to 'users' successfully.<br>";
    } else {
        echo "Error adding column 'email': " . $conn->error . "<br>";
    }
} else {
    echo "Column 'email' already exists.<br>";
}

echo "Database update complete.";
?>