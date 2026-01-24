<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-User-ID");

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

// Note: Rate limiter and auth_middleware should be included by individual API files
// as they need the $conn variable to be initialized first
?>