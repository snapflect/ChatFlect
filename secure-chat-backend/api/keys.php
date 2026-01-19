<?php
require 'db.php';

// Headers handled by db.php

// GET { user_id } -> Return Public Key
// GET { phone_number } -> Return Public Key (for contacts)

if (isset($_GET['user_id'])) {
    $uid = $_GET['user_id'];
    $stmt = $conn->prepare("SELECT public_key FROM users WHERE user_id = ?");
    $stmt->bind_param("s", $uid);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
} elseif (isset($_GET['phone_number'])) {
    $ph = $_GET['phone_number'];
    $stmt = $conn->prepare("SELECT id, public_key FROM users WHERE phone_number = ?");
    $stmt->bind_param("s", $ph);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
} else {
    echo json_encode(["error" => "Missing param"]);
    exit;
}

if ($result) {
    echo json_encode($result);
} else {
    http_response_code(404);
    echo json_encode(["error" => "User/Key not found"]);
}
?>