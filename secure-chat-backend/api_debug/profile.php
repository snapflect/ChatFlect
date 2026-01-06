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
        $stmt = $pdo->prepare("SELECT id FROM users WHERE phone_number = ?");
        $stmt->execute([$phone]);
        $user = $stmt->fetch();

        if ($user) {
            // User exists, update key if needed? Or just return ID
            // For E2E, changing key might break old chats, be careful. 
            // For Phase 1, we assume new install = new key = new identity effectively?
            // Let's update the key for now.
            $stmt = $pdo->prepare("UPDATE users SET public_key = ? WHERE id = ?");
            $stmt->execute([$publicKey, $user['id']]);
            $userId = $user['id'];
        } else {
            // New User
            $stmt = $pdo->prepare("INSERT INTO users (phone_number, public_key) VALUES (?, ?)");
            $stmt->execute([$phone, $publicKey]);
            $userId = $pdo->lastInsertId();

            // Create empty profile
            $stmt = $pdo->prepare("INSERT INTO profiles (user_id) VALUES (?)");
            $stmt->execute([$userId]);
        }

        echo json_encode(["status" => "success", "user_id" => $userId]);
    } elseif (isset($data->user_id)) {
        // Update Profile
        $userId = $data->user_id;

        // Sanitization
        $firstName = htmlspecialchars(strip_tags($data->first_name ?? ''));
        $lastName = htmlspecialchars(strip_tags($data->last_name ?? ''));
        $note = htmlspecialchars(strip_tags($data->short_note ?? ''));

        // Photo URL would be handled by a file upload script usually, skipping for brevity, assume URL sent
        $photoUrl = filter_var($data->photo_url ?? '', FILTER_SANITIZE_URL);

        $stmt = $pdo->prepare("UPDATE profiles SET first_name=?, last_name=?, short_note=?, photo_url=? WHERE user_id=?");
        $stmt->execute([$firstName, $lastName, $note, $photoUrl, $userId]);

        echo json_encode(["status" => "profile_updated"]);
    }
} elseif ($method === 'GET') {
    // Get Profile
    $userId = $_GET['user_id'];
    $stmt = $pdo->prepare("SELECT * FROM profiles WHERE user_id = ?");
    $stmt->execute([$userId]);
    $profile = $stmt->fetch();
    echo json_encode($profile);
}
?>