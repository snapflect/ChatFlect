<?php
require 'db.php';
$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['user_id'])) {
    $userId = $conn->real_escape_string($data['user_id']);

    // 1. Delete from Users
    $sql = "DELETE FROM users WHERE user_id = '$userId'";
    if ($conn->query($sql) === TRUE) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => $conn->error]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Missing user_id"]);
}
?>