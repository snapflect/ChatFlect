<?php
header("Content-Type: application/json");

require_once __DIR__ . '/../includes/secrets_manager.php';

$logDir = __DIR__ . '/logs/';
$testFile = $logDir . 'test_write.txt';
$envFile = __DIR__ . '/../.env';

$diag = [
    "php_user" => get_current_user(),
    "api_permissions" => substr(sprintf('%o', fileperms(__DIR__)), -4),
    "log_dir_exists" => file_exists($logDir),
    "is_writable" => is_writable(__DIR__),
    "env_file_exists" => file_exists($envFile),
    "env_file_readable" => is_readable($envFile),
    "secrets_audit" => [
        "DB_HOST" => SecretsManager::get('DB_HOST') ? "FOUND" : "MISSING",
        "DB_NAME" => SecretsManager::get('DB_NAME') ? "FOUND" : "MISSING",
        "DB_USER" => SecretsManager::get('DB_USER') ? "FOUND" : "MISSING",
        "DB_PASS" => SecretsManager::get('DB_PASSWORD') ? "FOUND" : "MISSING",
    ]
];

if (!$diag["log_dir_exists"]) {
    $diag["mkdir_attempt"] = mkdir($logDir, 0755, true);
    $diag["log_dir_exists_after"] = file_exists($logDir);
}

if ($diag["log_dir_exists"] || ($diag["mkdir_attempt"] ?? false)) {
    $diag["file_write_attempt"] = file_put_contents($testFile, "Test at " . date('Y-m-d H:i:s'));
    $diag["file_exists"] = file_exists($testFile);
    if ($diag["file_exists"]) {
        unlink($testFile); // Cleanup
    }
}

echo json_encode($diag);
?>