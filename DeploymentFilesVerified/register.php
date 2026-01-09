<?php
// register.php - Auth & Token Management
// UPDATED: 2026-01-10 (Fix Email Headers)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require 'db.php';

// ENABLE LOGGING
ini_set('log_errors', 1);
ini_set('error_log', 'auth_debug.log');

// 1. Get Input
$json = file_get_contents("php://input");
$data = json_decode($json);

if (!$data) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON"]);
    exit;
}

// 2. Handle Actions
if (isset($data->action)) {

    // --- UPDATE FCM TOKEN ---
    if ($data->action === 'update_token') {
        $userId = $data->user_id ?? '';
        $token = $data->fcm_token ?? '';

        if (!$userId || !$token) {
            echo json_encode(["error" => "Missing user_id or fcm_token"]);
            exit;
        }

        $stmt = $conn->prepare("UPDATE users SET fcm_token = ? WHERE user_id = ?");
        $stmt->bind_param("ss", $token, $userId);

        if ($stmt->execute()) {
            echo json_encode(["status" => "token_updated"]);
        } else {
            error_log("Token Update Failed: " . $conn->error);
            http_response_code(500);
            echo json_encode(["error" => "DB Error"]);
        }
        exit;
    }

    // --- CONFIRM OTP ---
    if ($data->action === 'confirm_otp') {
        $phone = $data->phone_number ?? '';
        $otpInput = $data->otp ?? '';
        $publicKey = $data->public_key ?? '';
        $email = $data->email ?? '';

        // Validate
        $stmt = $conn->prepare("SELECT id FROM otps WHERE phone_number = ? AND otp_code = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $stmt->bind_param("ss", $phone, $otpInput);
        $stmt->execute();
        $res = $stmt->get_result()->fetch_assoc();

        if (!$res) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid/Expired OTP"]);
            exit;
        }

        // Delete OTP
        $conn->query("DELETE FROM otps WHERE phone_number = '$phone'");

        // Upsert User
        $stmt = $conn->prepare("SELECT id, user_id FROM users WHERE phone_number = ?");
        $stmt->bind_param("s", $phone);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        $publicUserId = '';

        if ($user) {
            // Update Existing
            $publicUserId = $user['user_id'];
            $upd = $conn->prepare("UPDATE users SET public_key = ?, email = ? WHERE id = ?");
            $upd->bind_param("ssi", $publicKey, $email, $user['id']);
            $upd->execute();
        } else {
            // Create New
            $publicUserId = bin2hex(random_bytes(16));
            $ins = $conn->prepare("INSERT INTO users (user_id, phone_number, email, public_key) VALUES (?, ?, ?, ?)");
            $ins->bind_param("ssss", $publicUserId, $phone, $email, $publicKey);
            $ins->execute();
        }

        echo json_encode(["status" => "success", "user_id" => $publicUserId]);
        exit;
    }
}

// 3. Handle Registration (Request OTP) - Default logic if no action or other fields
if (isset($data->phone_number) && !isset($data->action)) {
    $phone = $data->phone_number;
    $email = $data->email ?? '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid Email"]);
        exit;
    }

    // Generate OTP
    $otp = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    $expires = date('Y-m-d H:i:s', strtotime('+5 minutes'));

    $stmt = $conn->prepare("INSERT INTO otps (phone_number, otp_code, expires_at) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $phone, $otp, $expires);

    if ($stmt->execute()) {
        // Send Email (ROBUST)
        $subject = "Your Login Code";
        $msg = "Your verification code is: $otp";

        // Hostinger requires From header match domain usually
        $headers = "From: no-reply@snapflect.com\r\n";
        $headers .= "Reply-To: no-reply@snapflect.com\r\n";
        // $headers .= "MIME-Version: 1.0\r\n";
        // $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

        if (mail($email, $subject, $msg, $headers)) {
            echo json_encode(["status" => "sent", "message" => "OTP Sent to $email"]);
        } else {
            error_log("Mail Failed for $email. OTP was: $otp");
            echo json_encode(["status" => "sent", "message" => "OTP Generated (Mail Failed - Check Logs)"]);
        }
    } else {
        http_response_code(500);
        echo json_encode(["error" => "DB Error"]);
    }
    exit;
}
?>