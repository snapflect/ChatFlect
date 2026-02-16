<?php
// CORS is handled by .htaccess for better performance and error handling.
// OPTIONS requests are intercepted by .htaccess, but we keep this as a secondary safety.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Include secrets manager
require_once __DIR__ . '/../includes/secrets_manager.php';

// Production Credentials (via SecretsManager)
// SECURITY: No hardcoded fallbacks allowed. Must be set via Docker Secret or Env Var.
$servername = SecretsManager::get('DB_HOST') ?? 'localhost';
$username = SecretsManager::get('DB_USER');
$password = SecretsManager::get('DB_PASSWORD');
$dbname = SecretsManager::get('DB_NAME');

if (!$username || !$password || !$dbname) {
    error_log("CRITICAL: Database credentials missing in environment.");
    die(json_encode(["error" => "Configuration Error"]));
}

$conn = new mysqli($servername, $username, $password, $dbname);
$conn->set_charset("utf8mb4");

if ($conn->connect_error) {
    // Don't leak connection details in production
    error_log("Connection failed: " . $conn->connect_error);
    die(json_encode(["error" => "Service Unavailable"]));
}

// ...

/**
 * Get PDO connection (for services that need PDO like security_alerts.php)
 */
function getDbPdo()
{
    static $pdo = null;
    if ($pdo === null) {
        $host = SecretsManager::get('DB_HOST') ?? 'localhost';
        $db = SecretsManager::get('DB_NAME');
        $user = SecretsManager::get('DB_USER');
        $pass = SecretsManager::get('DB_PASSWORD');

        if (!$user || !$pass || !$db) {
            throw new Exception("Database credentials missing");
        }

        $pdo = new PDO(
            "mysql:host=$host;dbname=$db;charset=utf8mb4",
            $user,
            $pass,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]
        );
    }
    return $pdo;
}
?>