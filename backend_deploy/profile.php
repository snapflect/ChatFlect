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

        // Check if user exists
        $stmt = $pdo->prepare("SELECT id, user_id FROM users WHERE phone_number = ?");
        $stmt->execute([$phone]);
        $user = $stmt->fetch();

        if ($user) {
            // User exists, update key if needed? Or just return ID
            // For E2E, changing key might break old chats, be careful. 
            // For Phase 1, we assume new install = new key = new identity
            // Update Key
            $stmt = $pdo->prepare("UPDATE users SET public_key = ? WHERE id = ?");
            $stmt->execute([$publicKey, $user['id']]);

            // Check if user_id (UUID) is missing (Migration for old users)
            if (empty($user['user_id'])) {
                $publicUserId = bin2hex(random_bytes(16));
                $stmt = $pdo->prepare("UPDATE users SET user_id = ? WHERE id = ?");
                $stmt->execute([$publicUserId, $user['id']]);
            } else {
                $publicUserId = $user['user_id'];
            }
        } else {
            // New User
            // Generate a random public user_id (32 hex chars)
            $publicUserId = bin2hex(random_bytes(16));

            $stmt = $pdo->prepare("INSERT INTO users (user_id, phone_number, public_key) VALUES (?, ?, ?)");
            $stmt->execute([$publicUserId, $phone, $publicKey]);
            // $userId = $pdo->lastInsertId(); // We don't want to expose this authentication-wise if we want consistency

            // Note: We don't use a separate profiles table anymore. Columns are in users.
        }
        echo json_encode(["status" => "success", "user_id" => $publicUserId]);
    } elseif (isset($data->user_id)) {
        // Update Profile
        $userId = $data->user_id;

        // Sanitization
        $firstName = htmlspecialchars(strip_tags($data->first_name ?? ''));
        $lastName = htmlspecialchars(strip_tags($data->last_name ?? ''));
        $note = htmlspecialchars(strip_tags($data->short_note ?? ''));

        // Photo URL would be handled by a file upload script usually, skipping for brevity, assume URL sent
        $photoUrl = filter_var($data->photo_url ?? '', FILTER_SANITIZE_URL);

        // UPDATE users table directly
        $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, short_note=?, photo_url=? WHERE id=?");
        $stmt->execute([$firstName, $lastName, $note, $photoUrl, $userId]);

        echo json_encode(["status" => "profile_updated"]);
    }
} elseif ($method === 'GET') {
    // Get Profile
    $userId = $_GET['user_id'];
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $profile = $stmt->fetch();
    echo json_encode($profile);
}
?>