<?php
// Headers FIRST - to ensure they are sent even if db.php fails
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require 'db.php';

// Simulate OTP for Phase 1
// POST { phone_number }
// 1. Validate JSON
$json = file_get_contents("php://input");
$data = json_decode($json);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("Register API: Invalid JSON received");
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON payload"]);
    exit;
}

// 2. Validate Phone Number (Basic E.164 or digits check 10-15 chars)
if (!isset($data->phone_number) || !preg_match('/^\+?[0-9]{10,15}$/', $data->phone_number)) {
    error_log("Register API: Invalid Phone Number - " . ($data->phone_number ?? 'Missing'));
    http_response_code(400);
    echo json_encode(["error" => "Valid phone number required (10-15 digits)"]);
    exit;
}

$phone = $data->phone_number;
// In real app: Generate 6 digit OTP, save to DB with expiry, send via SMS.
// Phase 1 Mock: Just return success and a fixed OTP or auto-verify logic client side?
// Actually, let's just "Register/Login" in one step for Phase 1 simplicity if they provide a key, 
// OR just return an OTP code in the response so the user can "type it in".

$otp = "123456"; // Fixed Mock OTP

echo json_encode(["message" => "OTP sent", "otp" => $otp, "debug_info" => "Use 123456"]);
?>