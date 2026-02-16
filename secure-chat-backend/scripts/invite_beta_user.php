<?php
/**
 * scripts/invite_beta_user.php
 * Epic 101-HF: Secure User Invitation
 * Usage: php invite_beta_user.php -u <username> -e <email>
 */

// Basic CLI Argument Parsing
$options = getopt("u:e:");
if (!isset($options['u']) || !isset($options['e'])) {
    echo "Usage: php invite_beta_user.php -u <username> -e <email>\n";
    exit(1);
}

$username = $options['u'];
$email = $options['e'];

// generate a random 12-char password
$tempPassword = bin2hex(random_bytes(6));

// 1. Database Connection
$host = getenv('DB_HOST') ?: 'localhost';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';
$name = getenv('DB_NAME') ?: 'chatflect_staging';

$mysqli = new mysqli($host, $user, $pass, $name);

if ($mysqli->connect_error) {
    die("❌ Connection failed: " . $mysqli->connect_error . "\n");
}

// 2. Security: Hash the password
$passwordHash = password_hash($tempPassword, PASSWORD_ARGON2ID);

// 3. Insert User
$stmt = $mysqli->prepare("INSERT INTO users (username, email, password_hash, is_active) VALUES (?, ?, ?, 1)");
if (!$stmt) {
    die("❌ Prepare failed: " . $mysqli->error . "\n");
}

$stmt->bind_param("sss", $username, $email, $passwordHash);

if ($stmt->execute()) {
    echo "\n✅ User Created Successfully!\n";
    echo "--------------------------------------------------\n";
    echo "Username : " . $username . "\n";
    echo "Email    : " . $email . "\n";
    echo "Password : " . $tempPassword . "  <-- SHARE THIS SECURELY\n";
    echo "--------------------------------------------------\n";
    echo "⚠️  Ensure the user changes this password on first login.\n";
} else {
    echo "❌ Error: " . $stmt->error . "\n";
}

$stmt->close();
$mysqli->close();
?>