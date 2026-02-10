<?php
// scripts/run_pending_migrations.php
// Epic 38: Safe Migration Runner

require_once __DIR__ . '/../includes/env.php';

echo "=== Migration Runner ===\n";

$host = env('DB_HOST', 'localhost');
$user = env('DB_USER', 'root');
$pass = env('DB_PASS', '');
$name = env('DB_NAME', 'chatflect_db');

try {
    $pdo = new PDO("mysql:host=$host;dbname=$name", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo "❌ DB connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// Ensure migrations table exists
$pdo->exec("CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

// Get applied migrations
$applied = $pdo->query("SELECT filename FROM migrations")->fetchAll(PDO::FETCH_COLUMN);
echo "Applied: " . count($applied) . " migrations\n";

// Find migration files
$migrationDir = __DIR__ . '/../migrations';
$files = glob("$migrationDir/*.sql");
sort($files);

$pending = [];
foreach ($files as $file) {
    $filename = basename($file);
    if (!in_array($filename, $applied)) {
        $pending[] = $file;
    }
}

if (empty($pending)) {
    echo "✅ No pending migrations\n";
    exit(0);
}

echo "Pending: " . count($pending) . " migrations\n\n";

foreach ($pending as $file) {
    $filename = basename($file);
    echo "Applying: $filename... ";

    try {
        $sql = file_get_contents($file);
        $pdo->exec($sql);

        $stmt = $pdo->prepare("INSERT INTO migrations (filename) VALUES (?)");
        $stmt->execute([$filename]);

        echo "✅\n";
    } catch (PDOException $e) {
        echo "❌ FAILED\n";
        echo "Error: " . $e->getMessage() . "\n";
        exit(1);
    }
}

echo "\n✅ All migrations applied\n";
