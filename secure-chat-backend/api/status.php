<?php
require 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'feed') {
    // Return statuses from last 24h
    $yesterday = date('Y-m-d H:i:s', time() - 86400);
    $sql = "SELECT s.*, u.first_name, u.last_name, u.photo_url as user_photo 
            FROM status_updates s 
            JOIN users u ON s.user_id = u.user_id 
            WHERE s.created_at > '$yesterday' 
            ORDER BY s.created_at ASC";

    $result = $conn->query($sql);
    $feed = [];
    while ($row = $result->fetch_assoc()) {
        $feed[] = $row;
    }
    echo json_encode($feed);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['file']) && isset($_POST['user_id'])) {
        $uid = $conn->real_escape_string($_POST['user_id']);
        $caption = isset($_POST['caption']) ? $conn->real_escape_string($_POST['caption']) : '';

        $target_dir = "uploads/";
        if (!file_exists($target_dir))
            mkdir($target_dir, 0777, true);

        $ext = pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION);
        $filename = uniqid('status_') . '.' . $ext;
        $target_file = $target_dir . $filename;

        if (move_uploaded_file($_FILES['file']['tmp_name'], $target_file)) {
            $sql = "INSERT INTO status_updates (user_id, media_url, caption) VALUES ('$uid', '$target_file', '$caption')";
            if ($conn->query($sql)) {
                echo json_encode(["status" => "success"]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => $conn->error]);
            }
        }
    }
}
?>