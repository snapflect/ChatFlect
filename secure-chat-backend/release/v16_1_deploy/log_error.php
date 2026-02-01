<?php
require 'db.php'; // Include for CORS headers, though we might not need DB if just file logging

// Headers handled by db.php

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

if ($data) {
    $level = isset($data['level']) ? strtoupper($data['level']) : 'INFO';
    $message = isset($data['message']) ? $data['message'] : 'No message';
    $context = isset($data['context']) ? json_encode($data['context']) : '';

    // Use Indian Standard Time (IST) for log timestamps
    date_default_timezone_set('Asia/Kolkata');
    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'];

    // Log Format: [TIMESTAMP] [IP] [LEVEL] Message {Context}
    $logEntry = "[$timestamp] [$ip] [$level] $message $context" . PHP_EOL;

    // Daily Log File
    $logDir = 'logs/';
    if (!file_exists($logDir)) {
        mkdir($logDir, 0777, true);
        // Secure directory
        file_put_contents($logDir . '.htaccess', 'Deny from all');
    }

    $filename = $logDir . 'app_log_' . date('Y-m-d') . '.log';

    file_put_contents($filename, $logEntry, FILE_APPEND);

    echo json_encode(["status" => "success"]);
} else {
    http_response_code(400);
    echo json_encode(["error" => "Invalid Data"]);
}
?>