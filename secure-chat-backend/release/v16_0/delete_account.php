<?php
require 'db.php';
require_once 'rate_limiter.php';
enforceRateLimit();

$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['user_id'])) {
    $userId = $data['user_id'];

    // Delete user using prepared statement
    $stmt = $conn->prepare("DELETE FROM users WHERE user_id = ?");
    $stmt->bind_param("s", $userId);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode(["status" => "success"]);
        } else {
            echo json_encode(["status" => "error", "message" => "User not found"]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Database error"]);
    }
    $stmt->close();
} else {
    echo json_encode(["status" => "error", "message" => "Missing user_id"]);
}
?>