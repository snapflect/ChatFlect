<?php
// Headers handled by db.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';
require_once 'rate_limiter.php';
enforceRateLimit();
require_once 'email_service.php';

// Load email config for rate limiting settings
$emailConfig = require 'email_config.php';

// 1. Extract JSON Data
$json = file_get_contents("php://input");
$data = json_decode($json);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON payload"]);
    exit;
}

$email = $data->email ?? '';
$phone = $data->phone_number ?? null;
$action = $data->action ?? 'registration';

// 3. Validate Action-Specific Requirements
if ($action === 'phone_update' && !$phone) {
    http_response_code(400);
    echo json_encode(["error" => "Phone number required for update"]);
    exit;
}

if ($phone && !preg_match('/^\+?[0-9]{10,15}$/', $phone)) {
    http_response_code(400);
    echo json_encode(["error" => "Valid phone number required (10-15 digits)"]);
    exit;
}

// 4. Validate Email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "Valid email required for verification"]);
    exit;
}

// 5. Rate Limiting - Check recent OTP requests (By Email)
try {
    $rateLimitMinutes = $emailConfig['rate_limit_period_minutes'];
    $maxRequests = $emailConfig['max_otp_requests_per_period'];

    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM otps WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)");
    $stmt->bind_param("si", $email, $rateLimitMinutes);
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
}

// 6. Security Check for Phone Update
if ($action === 'phone_update') {
    $cachedExists = CacheService::checkUserExists($phone);
    if ($cachedExists === true) {
        http_response_code(409);
        echo json_encode(["error" => "This phone number is already linked to another account"]);
        exit;
    }

    $stmt = $conn->prepare("SELECT user_id FROM users WHERE phone_number = ?");
    $stmt->bind_param("s", $phone);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        CacheService::cacheUserExistence($phone, true);
        http_response_code(409);
        echo json_encode(["error" => "This phone number is already linked to another account"]);
        exit;
    }
    $stmt->close();
}

// 5. Generate & Store OTP
try {
    // Generate 6-digit OTP
    $otp = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiryMinutes = $emailConfig['otp_expiry_minutes'];
    $expires_at = date('Y-m-d H:i:s', strtotime("+$expiryMinutes minutes"));

    // Delete any existing OTPs for this email (cleanup)
    $delStmt = $conn->prepare("DELETE FROM otps WHERE email = ? AND expires_at < NOW()");
    $delStmt->bind_param("s", $email);
    $delStmt->execute();

    // Insert new OTP
    $type = (isset($data->action) && $data->action === 'phone_update') ? 'phone_update' : 'registration';
    $newPhone = $data->phone_number ?? null;

    $stmt = $conn->prepare("INSERT INTO otps (email, phone_number, otp_code, type, expires_at) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sssss", $email, $newPhone, $otp, $type, $expires_at);

    if (!$stmt->execute()) {
        throw new Exception("DB Error inserting OTP: " . $stmt->error);
    }

    // 6. Send Email via SMTP
    if ($action === 'phone_update') {
        $emailResult = EmailService::sendPhoneUpdateOTP($email, $otp, $phone);
    } else {
        $emailResult = EmailService::sendOTP($email, $otp);
    }

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