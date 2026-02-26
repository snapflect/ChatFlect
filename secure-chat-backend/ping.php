<?php
header("Content-Type: application/json");
require_once __DIR__ . '/api/db.php';

echo json_encode([
    "status" => "online",
    "timestamp" => date('Y-m-d H:i:s'),
    "api_version" => "v2.3-hardened",
    "db_connection" => isset($conn) && $conn->ping() ? "healthy" : "error"
]);
?>