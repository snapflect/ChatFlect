<?php
require 'db.php';

// Ensure Views Table
$conn->query("CREATE TABLE IF NOT EXISTS status_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    viewer_id VARCHAR(50) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_view (status_id, viewer_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE
)");

// Fetch Feed
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'feed') {
    // Return statuses from last 24h
    $yesterday = date('Y-m-d H:i:s', time() - 86400);

    $sql = "SELECT s.*, u.first_name, u.last_name, u.photo_url as user_photo,
            (SELECT COUNT(*) FROM status_views sv WHERE sv.status_id = s.id) as view_count
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

// Record View
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'view') {
    $data = json_decode(file_get_contents("php://input"), true);
    $statusId = $conn->real_escape_string($data['status_id']);
    $viewerId = $conn->real_escape_string($data['viewer_id']);

    $sql = "INSERT IGNORE INTO status_views (status_id, viewer_id) VALUES ('$statusId', '$viewerId')";
    if ($conn->query($sql)) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => $conn->error]);
    }
    exit;
}

// Get Viewers
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'viewers') {
    $statusId = $conn->real_escape_string($_GET['status_id']);

    $sql = "SELECT u.first_name, u.last_name, u.photo_url, sv.viewed_at 
            FROM status_views sv
            JOIN users u ON sv.viewer_id = u.user_id
            WHERE sv.status_id = '$statusId'
            ORDER BY sv.viewed_at DESC";

    $result = $conn->query($sql);
    $viewers = [];
    while ($row = $result->fetch_assoc()) {
        $viewers[] = $row;
    }
    echo json_encode($viewers);
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