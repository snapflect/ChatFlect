<?php
// Headers handled by db.php
require 'db.php';
require_once 'email_service.php';

// Load email config for rate limiting settings
$emailConfig = require 'email_config.php';

// POST { phone_number, email }
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

// 4. Rate Limiting - Check recent OTP requests
try {
    $rateLimitMinutes = $emailConfig['rate_limit_period_minutes'];
    $maxRequests = $emailConfig['max_otp_requests_per_period'];

    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM otps WHERE phone_number = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)");
    $stmt->bind_param("si", $phone, $rateLimitMinutes);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    if ($result['count'] >= $maxRequests) {
        http_response_code(429);
        echo json_encode([
            "error" => "Too many OTP requests. Please wait a few minutes before trying again.",
            "retry_after" => $rateLimitMinutes * 60
        ]);
        exit;
    }
} catch (Exception $e) {
    error_log("Rate limit check error: " . $e->getMessage());
    // Continue anyway, don't block on rate limit check failure
}

// 5. Generate & Store OTP
try {
    // Generate 6-digit OTP
    $otp = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiryMinutes = $emailConfig['otp_expiry_minutes'];
    $expires_at = date('Y-m-d H:i:s', strtotime("+$expiryMinutes minutes"));

    // Delete any existing OTPs for this phone (cleanup)
    $delStmt = $conn->prepare("DELETE FROM otps WHERE phone_number = ? AND expires_at < NOW()");
    $delStmt->bind_param("s", $phone);
    $delStmt->execute();

    // Insert new OTP
    $stmt = $conn->prepare("INSERT INTO otps (phone_number, otp_code, expires_at) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $phone, $otp, $expires_at);

    if (!$stmt->execute()) {
        throw new Exception("DB Error inserting OTP: " . $stmt->error);
    }

    // 6. Send Email via SMTP
    $emailResult = EmailService::sendOTP($email, $otp);

    if ($emailResult['success']) {
        echo json_encode([
            "message" => "OTP sent to email",
            "status" => "sent"
        ]);
    } else {
        // Log the OTP for debugging but still return success to user
        error_log("SMTP failed, OTP for $phone: $otp - Error: " . $emailResult['message']);

        // Try fallback to PHP mail()
        $subject = "Your SnapFlect Login Code";
        $message = "Your verification code is: $otp\n\nThis code expires in 5 minutes.";
        $headers = "From: official@snapflect.com";

        if (mail($email, $subject, $message, $headers)) {
            echo json_encode([
                "message" => "OTP sent to email",
                "status" => "sent",
                "method" => "fallback"
            ]);
        } else {
            echo json_encode([
                "message" => "OTP generated (Check email or logs)",
                "status" => "sent",
                "debug" => "email_issue"
            ]);
        }
    }

} catch (Exception $e) {
    error_log("OTP Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Internal Server Error"]);
}
?>