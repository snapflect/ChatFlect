<?php
require 'db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// POST { phone_number, public_key } -> Register/Login Confirm
// POST { user_id, first_name, last_name, ... } -> Update Profile
// GET { user_id } -> Get Profile

$method = $_SERVER['REQUEST_METHOD'];
$json = file_get_contents("php://input");
$data = json_decode($json);

if ($method === 'POST' && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON"]);
    exit;
}

if ($method === 'POST') {
    if (isset($data->action) && $data->action === 'confirm_otp') {
        // Finalize registration
        $phone = $data->phone_number;
        $publicKey = $data->public_key;
        $otpInput = $data->otp ?? '';
        $email = $data->email ?? null;

        if (empty($otpInput)) {
            http_response_code(400);
            echo json_encode(["error" => "OTP required"]);
            exit;
        }

        // 1. Verify OTP
        $stmt = $conn->prepare("SELECT id, expires_at FROM otps WHERE phone_number = ? AND otp_code = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $stmt->bind_param("ss", $phone, $otpInput);
        $stmt->execute();
        $res = $stmt->get_result();
        $otpRecord = $res->fetch_assoc();

        if (!$otpRecord) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid or Expired OTP"]);
            exit;
        }

        // OTP Valid! Delete used
        $del = $conn->prepare("DELETE FROM otps WHERE phone_number = ?");
        $del->bind_param("s", $phone);
        $del->execute();

        // 2. Proceed with User Logic
        $stmt = $conn->prepare("SELECT id, user_id FROM users WHERE phone_number = ?");
        $stmt->bind_param("s", $phone);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        if ($user) {
            $isNewUser = false;
            $update = $conn->prepare("UPDATE users SET public_key = ?, email = ? WHERE id = ?");
            $update->bind_param("ssi", $publicKey, $email, $user['id']);
            $update->execute();

            if (empty($user['user_id'])) {
                $publicUserId = bin2hex(random_bytes(16));
                $u_up = $conn->prepare("UPDATE users SET user_id = ? WHERE id = ?");
                $u_up->bind_param("si", $publicUserId, $user['id']);
                $u_up->execute();
            } else {
                $publicUserId = $user['user_id'];
            }
        } else {
            // New User
            $isNewUser = true;
            $publicUserId = bin2hex(random_bytes(16));
            $ins = $conn->prepare("INSERT INTO users (user_id, phone_number, email, public_key) VALUES (?, ?, ?, ?)");
            $ins->bind_param("ssss", $publicUserId, $phone, $email, $publicKey);
            $ins->execute();
        }

        echo json_encode(["status" => "success", "user_id" => $publicUserId, "is_new_user" => $isNewUser]);
    } elseif (isset($data->user_id)) {
        // Update Profile
        $userId = $data->user_id;

        // Sanitization
        $firstName = htmlspecialchars(strip_tags($data->first_name ?? ''));
        $lastName = htmlspecialchars(strip_tags($data->last_name ?? ''));
        $note = htmlspecialchars(strip_tags($data->short_note ?? ''));

        // Photo URL 
        $photoUrl = filter_var($data->photo_url ?? '', FILTER_SANITIZE_URL);

        // UPDATE users table directly (MySQLi)
        // We use user_id (UUID string) as the selector, not the auto-inc ID
        $stmt = $conn->prepare("UPDATE users SET first_name=?, last_name=?, short_note=?, photo_url=? WHERE user_id=?");
        $stmt->bind_param("sssss", $firstName, $lastName, $note, $photoUrl, $userId);
        $stmt->execute();

        echo json_encode(["status" => "profile_updated"]);
    }
} elseif ($method === 'GET') {
    // Get Profile
    $userId = $_GET['user_id'];
    $stmt = $conn->prepare("SELECT * FROM users WHERE user_id = ?");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();
    echo json_encode($profile);
}
?>