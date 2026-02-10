<?php
// CORS is handled by .htaccess for better performance and error handling.
// OPTIONS requests are intercepted by .htaccess, but we keep this as a secondary safety.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Production Credentials (Hostinger)
$servername = 'localhost';
$username = 'u668772406_chat_admin';
$password = 'MusMisMM@1';
$dbname = 'u668772406_secure_chat';

$conn = new mysqli($servername, $username, $password, $dbname);
$conn->set_charset("utf8mb4");

if ($conn->connect_error) {
    die(json_encode(["error" => "Connection failed: " . $conn->connect_error]));
}

// Include security middleware
require_once __DIR__ . '/sanitizer.php';
require_once __DIR__ . '/audit_log.php';
require_once __DIR__ . '/cache_service.php';

/**
 * Enhanced Response Helper with ETag Caching
 */
function sendResponse($data, $httpCode = 200)
{
    $content = json_encode($data);
    $etag = md5($content);

    header("ETag: \"$etag\"");
    header("Cache-Control: public, max-age=60"); // 1 min buffer for client

    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH'], '"') === $etag) {
        http_response_code(304);
        exit;
    }

    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo $content;
    exit;
}

// Note: Rate limiter and auth_middleware should be included by individual API files
// as they need the $conn variable to be initialized first

/**
 * Get PDO connection (for services that need PDO like security_alerts.php)
 */
function getDbPdo()
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=localhost;dbname=u668772406_secure_chat;charset=utf8mb4',
            'u668772406_chat_admin',
            'MusMisMM@1',
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]
        );
    }
    return $pdo;
}
?>