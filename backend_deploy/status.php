<?php
require 'db.php';

// Fetch Feed
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'feed') {
    // Return statuses from last 24h
    $yesterday = date('Y-m-d H:i:s', time() - 86400);

    // TODO: Filter by Privacy (requires "viewer_id" to check contacts/whitelist)
    // For MVP, returning all public/contact statuses.

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

// Create Status
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid = $_POST['user_id'] ?? null;
    if (!$uid) {
        http_response_code(400);
        die(json_encode(["error" => "User ID required"]));
    }

    $uid = $conn->real_escape_string($uid);
    $type = $_POST['type'] ?? 'image'; // image, video, text
    $privacy = $_POST['privacy'] ?? 'everyone';
    $target_file = ''; // Null for text

    // 1. Handle File Upload (Image/Video)
    if ($type !== 'text' && isset($_FILES['file'])) {
        $caption = $conn->real_escape_string($_POST['caption'] ?? '');
        $target_dir = "uploads/";
        if (!file_exists($target_dir))
            mkdir($target_dir, 0777, true);

        $ext = pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION);
        $filename = uniqid('status_') . '.' . $ext;
        $target_file = $target_dir . $filename;

        if (!move_uploaded_file($_FILES['file']['tmp_name'], $target_file)) {
            http_response_code(500);
            die(json_encode(["error" => "Upload Failed"]));
        }

        $sql = "INSERT INTO status_updates (user_id, media_url, type, caption, privacy) 
                VALUES ('$uid', '$target_file', '$type', '$caption', '$privacy')";
    }
    // 2. Handle Text Status
    else {
        $text_content = $conn->real_escape_string($_POST['text_content'] ?? '');
        $bg_color = $conn->real_escape_string($_POST['background_color'] ?? '#000000');
        $font = $conn->real_escape_string($_POST['font'] ?? 'sans-serif');
        $type = 'text'; // Enforce type

        // For Text, media_url can be null or empty string
        $sql = "INSERT INTO status_updates (user_id, type, text_content, background_color, font, privacy, media_url) 
                VALUES ('$uid', 'text', '$text_content', '$bg_color', '$font', '$privacy', NULL)";
    }

    if ($conn->query($sql)) {
        echo json_encode(["status" => "success"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => $conn->error]);
    }
}
?>