<?php
// test.php - Simple Connectivity Check
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

echo json_encode([
    "status" => "success",
    "message" => "Connection Successful!",
    "ssl" => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'Active' : 'Inactive'
]);
?>