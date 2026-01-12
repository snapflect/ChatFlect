<?php
require 'db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$json = file_get_contents("php://input");
$data = json_decode($json);

if ($method === 'POST' && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400); echo json_encode(["error" => "Invalid JSON"]); exit;
}

if ($method === 'POST') {
    if (isset($data->action) && $data->action === 'confirm_otp') {
        $phone = $data->phone_number;
        $publicKey = $data->public_key;
        $otpInput = $data->otp ?? '';
        $email = $data->email ?? null;

        if (empty($otpInput)) { http_response_code(400); echo json_encode(["error" => "OTP required"]); exit; }

        $stmt = $conn->prepare("SELECT id, expires_at FROM otps WHERE phone_number = ? AND otp_code = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $stmt->bind_param("ss", $phone, $otpInput);
        $stmt->execute();
        $otpRecord = $stmt->get_result()->fetch_assoc();

        if (!$otpRecord) { http_response_code(400); echo json_encode(["error" => "Invalid or Expired OTP"]); exit; }

        $del = $conn->prepare("DELETE FROM otps WHERE phone_number = ?");
        $del->bind_param("s", $phone);
        $del->execute();

        $stmt = $conn->prepare("SELECT id, user_id FROM users WHERE phone_number = ?");
        $stmt->bind_param("s", $phone);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        if ($user) {
            $isNewUser = false;
            $updateKey = $conn->prepare("UPDATE users SET public_key = ? WHERE id = ?");
            $updateKey->bind_param("si", $publicKey, $user['id']);
            $updateKey->execute();
            try {
                $updateEmail = $conn->prepare("UPDATE users SET email = ? WHERE id = ?");
                $updateEmail->bind_param("si", $email, $user['id']);
                $updateEmail->execute();
            } catch (Exception $e) {}

            if (empty($user['user_id'])) {
                $publicUserId = bin2hex(random_bytes(16));
                $u_up = $conn->prepare("UPDATE users SET user_id = ? WHERE id = ?");
                $u_up->bind_param("si", $publicUserId, $user['id']);
                $u_up->execute();
            } else {
                $publicUserId = $user['user_id'];
            }
        } else {
            $isNewUser = true;
            $publicUserId = bin2hex(random_bytes(16));
            $ins = $conn->prepare("INSERT INTO users (user_id, phone_number, email, public_key) VALUES (?, ?, ?, ?)");
            $ins->bind_param("ssss", $publicUserId, $phone, $email, $publicKey);
            $ins->execute();
        }
        echo json_encode(["status" => "success", "user_id" => $publicUserId, "is_new_user" => $isNewUser]);

    } elseif (isset($data->user_id)) {
        $userId = $data->user_id;
        $check = $conn->prepare("SELECT id FROM users WHERE user_id = ?");
        $check->bind_param("s", $userId);
        $check->execute();
        if ($check->get_result()->num_rows === 0) {
            http_response_code(404); echo json_encode(["error" => "User ID not found in DB", "sent_id" => $userId]); exit;
        }

        $fields = []; $types = ""; $params = [];
        if (isset($data->first_name)) { $fields[] = "first_name=?"; $types .= "s"; $params[] = htmlspecialchars(strip_tags($data->first_name)); }
        if (isset($data->last_name)) { $fields[] = "last_name=?"; $types .= "s"; $params[] = htmlspecialchars(strip_tags($data->last_name)); }
        if (isset($data->short_note)) { $fields[] = "short_note=?"; $types .= "s"; $params[] = htmlspecialchars(strip_tags($data->short_note)); }
        if (isset($data->photo_url)) { $fields[] = "photo_url=?"; $types .= "s"; $params[] = filter_var($data->photo_url, FILTER_SANITIZE_URL); }

        if (empty($fields)) { echo json_encode(["status" => "no_fields_to_update"]); exit; }

        $sql = "UPDATE users SET " . implode(", ", $fields) . " WHERE user_id=?";
        $types .= "s"; $params[] = $userId;

        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();

        if ($stmt->affected_rows > 0) {
            echo json_encode(["status" => "profile_updated", "affected" => $stmt->affected_rows]);
        } else {
            echo json_encode(["status" => "no_changes_made", "info" => "Values identical or failed"]);
        }
    }
} elseif ($method === 'GET') {
    $userId = $_GET['user_id'];
    $stmt = $conn->prepare("SELECT * FROM users WHERE user_id = ?");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();
    echo json_encode($profile);
}
?>