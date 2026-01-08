<?php
require 'db.php';
$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['action']) && $data['action'] === 'update_token') {
    $user_id = $conn->real_escape_string($data['user_id']);
    $token = $conn->real_escape_string($data['fcm_token']);

    $sql = "UPDATE users SET fcm_token = '$token' WHERE user_id = '$user_id'";
    if ($conn->query($sql)) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => $conn->error]);
    }
    exit;
}

if (isset($data['phone_number'])) {
    echo json_encode(["status" => "success", "message" => "OTP Sent (Mock: 123456)"]);
}
?>