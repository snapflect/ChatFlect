<?php
require 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $user_id = $conn->real_escape_string($_GET['user_id']);
    $sql = "SELECT user_id, first_name, last_name, short_note, photo_url FROM users WHERE user_id = '$user_id'";
    $result = $conn->query($sql);
    if ($result->num_rows > 0) {
        echo json_encode($result->fetch_assoc());
    } else {
        echo json_encode(["error" => "User not found"]);
    }
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['action']) && $data['action'] === 'confirm_otp') {
    $phone = $conn->real_escape_string($data['phone_number']);
    $pubKey = $conn->real_escape_string($data['public_key']);

    $check = $conn->query("SELECT user_id FROM users WHERE phone_number = '$phone'");

    if ($check->num_rows > 0) {
        $row = $check->fetch_assoc();
        echo json_encode(["status" => "success", "user_id" => $row['user_id'], "message" => "Login successful"]);
    } else {
        $user_id = uniqid('user_');
        $sql = "INSERT INTO users (user_id, phone_number, public_key) VALUES ('$user_id', '$phone', '$pubKey')";
        if ($conn->query($sql)) {
            echo json_encode(["status" => "success", "user_id" => $user_id]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => $conn->error]);
        }
    }
    exit;
}

if (isset($data['user_id'])) {
    $uid = $conn->real_escape_string($data['user_id']);
    $fname = isset($data['first_name']) ? $conn->real_escape_string($data['first_name']) : '';
    $lname = isset($data['last_name']) ? $conn->real_escape_string($data['last_name']) : '';
    $note = isset($data['short_note']) ? $conn->real_escape_string($data['short_note']) : '';
    $photo = isset($data['photo_url']) ? $conn->real_escape_string($data['photo_url']) : '';

    $updates = [];
    if ($fname)
        $updates[] = "first_name='$fname'";
    if ($lname)
        $updates[] = "last_name='$lname'";
    if ($note)
        $updates[] = "short_note='$note'";
    if ($photo)
        $updates[] = "photo_url='$photo'";

    if (count($updates) > 0) {
        $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE user_id='$uid'";
        if ($conn->query($sql)) {
            echo json_encode(["status" => "success"]);
        } else {
            echo json_encode(["error" => $conn->error]);
        }
    } else {
        echo json_encode(["status" => "no_changes"]);
    }
}
?>