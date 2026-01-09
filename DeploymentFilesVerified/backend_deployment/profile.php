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
        $email = $data->email ?? null; // Should be passed again or we trust the OTP is enough proof? 
        // Ideally we pass email here too to update user record.

        if (empty($otpInput)) {
            http_response_code(400);
            echo json_encode(["error" => "OTP required"]);
            exit;
        }

        // 1. Verify OTP
        // Check for latest valid OTP
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

        // OTP Valid! Delete used OTPs for this phone to prevent replay
        $del = $conn->prepare("DELETE FROM otps WHERE phone_number = ?");
        $del->bind_param("s", $phone);
        $del->execute();

        // 2. Proceed with User Logic (Create/Update)

        // Check if user exists (using MySQLi consistently now, previous file used $pdo mixed with mysqli in db.php? 
        // Wait, db.php uses `new mysqli`. `profile.php` uses `$pdo`?
        // Let's check `profile.php` again. It uses `$pdo` on line 34!
        // `db.php` in previous view used `$conn = new mysqli`.
        // This is a mismatch! `profile.php` code I saw earlier used `$stmt = $pdo->prepare`.
        // I MUST fix this driver mismatch. I will rewrite `profile.php` to use `$conn` (mysqli) from `db.php`.

        // Check user existence
        $stmt = $conn->prepare("SELECT id, user_id FROM users WHERE phone_number = ?");
        $stmt->bind_param("s", $phone);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        if ($user) {
            // Update Key & Email
            // Note: `setup_auth_v2` adds email column. Ensure it exists.
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
            $publicUserId = bin2hex(random_bytes(16));
            $ins = $conn->prepare("INSERT INTO users (user_id, phone_number, email, public_key) VALUES (?, ?, ?, ?)");
            $ins->bind_param("ssss", $publicUserId, $phone, $email, $publicKey);
            $ins->execute();
        }

        echo json_encode(["status" => "success", "user_id" => $publicUserId]);
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
        $stmt = $conn->prepare("UPDATE users SET first_name=?, last_name=?, short_note=?, photo_url=? WHERE id=?");
        // Wait, id in DB is Int or String(UUID)?
        // Original logic used `user_id` param but query said `WHERE id=?`.
        // If $data->user_id is the UUID string, we should use `WHERE user_id=?`.
        // Let's assume `id` (PK) is used if `user_id` matches PK, but Frontend sends the UUID string.
        // Let's check `AuthService`. It sets `user_id` in localStorage.
        // If it sends the UUID string, `WHERE id=?` (INT) will fail or match 0.
        // Better to use `WHERE user_id=?`.

        $stmt = $conn->prepare("UPDATE users SET first_name=?, last_name=?, short_note=?, photo_url=? WHERE user_id=?");
        $stmt->bind_param("sssss", $firstName, $lastName, $note, $photoUrl, $userId);
        $stmt->execute();

        echo json_encode(["status" => "profile_updated"]);
    }
} elseif ($method === 'GET') {
    // Get Profile
    $userId = $_GET['user_id'];
    // MySQLi
    $stmt = $conn->prepare("SELECT * FROM users WHERE user_id = ?");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();
    echo json_encode($profile);
}
?>