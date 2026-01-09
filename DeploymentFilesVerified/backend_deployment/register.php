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

// 3. Validate Email
$email = $data->email ?? '';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "Valid email required for verification"]);
    exit;
}

$phone = $data->phone_number;

// 4. Generate & Store OTP
try {
    // Generate 6-digit OTP
    $otp = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    $expires_at = date('Y-m-d H:i:s', strtotime('+5 minutes'));

    // Insert into DB
    // Assuming table `otps` exists (run setup_auth_v2.php)
    $stmt = $conn->prepare("INSERT INTO otps (phone_number, otp_code, expires_at) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $phone, $otp, $expires_at);

    if (!$stmt->execute()) {
        throw new Exception("DB Error inserting OTP: " . $stmt->error);
    }

    // 5. Send Email
    $subject = "Your Login Code";
    $message = "Your verification code is: $otp\n\nThis code expires in 5 minutes.";
    $headers = "From: no-reply@snapflect.com";

    if (mail($email, $subject, $message, $headers)) {
        echo json_encode(["message" => "OTP sent to email", "status" => "sent"]);
    } else {
        // Fallback for localhost testing where mail() might fail without setup
        error_log("Mail failed. Valid OTP generated: $otp");
        echo json_encode(["message" => "OTP generated (Check Email/Logs)", "status" => "sent", "debug" => "mail_failed"]);
    }

} catch (Exception $e) {
    error_log("OTP Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Internal Server Error"]);
}
?>