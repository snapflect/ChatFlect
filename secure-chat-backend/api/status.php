<?php
require 'db.php';

/* ---------- URL NORMALIZATION HELPERS ---------- */
function getBaseUrl(): string
{
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $protocol . '://' . $_SERVER['HTTP_HOST'];
}

function normalizePhotoUrl($photoUrl)
{
    if (empty($photoUrl))
        return null;
    if (str_starts_with($photoUrl, 'http'))
        return $photoUrl;

    // Return relative path pointing to the proxy
    return 'serve.php?file=' . $photoUrl;
}

// Ensure Views Table
$conn->query("CREATE TABLE IF NOT EXISTS status_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    viewer_id VARCHAR(50) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_view (status_id, viewer_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE
)");

// Ensure Muted Statuses Table
$conn->query("CREATE TABLE IF NOT EXISTS muted_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    muted_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_mute (user_id, muted_user_id)
)");

// Ensure Status Reactions Table
$conn->query("CREATE TABLE IF NOT EXISTS status_reactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    reaction VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_reaction (status_id, user_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE
)");

// Ensure Status Replies Table
$conn->query("CREATE TABLE IF NOT EXISTS status_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reply_type ENUM('text', 'emoji', 'sticker') DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE
)");

// Delete Status
if (
    $_SERVER['REQUEST_METHOD'] === 'DELETE' ||
    ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'delete')
) {

    $data = json_decode(file_get_contents("php://input"), true);
    $statusId = $data['status_id'] ?? $_GET['status_id'] ?? null;
    $userId = $data['user_id'] ?? $_GET['user_id'] ?? null;

    if (!$statusId || !$userId) {
        http_response_code(400);
        echo json_encode(["error" => "status_id and user_id required"]);
        exit;
    }

    // Only allow deletion of own status
    $stmt = $conn->prepare("DELETE FROM status_updates WHERE id = ? AND user_id = ?");
    $stmt->bind_param("is", $statusId, $userId);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode(["status" => "success"]);
        } else {
            echo json_encode(["error" => "Status not found or not owned by user"]);
        }
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Database error"]);
    }
    $stmt->close();
    exit;
}

// Mute/Unmute Status User
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'mute') {
    $data = json_decode(file_get_contents("php://input"), true);
    $userId = $data['user_id'] ?? null;
    $mutedUserId = $data['muted_user_id'] ?? null;
    $mute = $data['mute'] ?? true; // true = mute, false = unmute

    if (!$userId || !$mutedUserId) {
        http_response_code(400);
        echo json_encode(["error" => "user_id and muted_user_id required"]);
        exit;
    }

    if ($mute) {
        $stmt = $conn->prepare("INSERT IGNORE INTO muted_statuses (user_id, muted_user_id) VALUES (?, ?)");
        $stmt->bind_param("ss", $userId, $mutedUserId);
    } else {
        $stmt = $conn->prepare("DELETE FROM muted_statuses WHERE user_id = ? AND muted_user_id = ?");
        $stmt->bind_param("ss", $userId, $mutedUserId);
    }

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "muted" => $mute]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Database error"]);
    }
    $stmt->close();
    exit;
}

// React to Status
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'react') {
    $data = json_decode(file_get_contents("php://input"), true);
    $statusId = $data['status_id'] ?? null;
    $userId = $data['user_id'] ?? null;
    $reaction = $data['reaction'] ?? null; // emoji like '❤️', '😂', etc.

    if (!$statusId || !$userId || !$reaction) {
        http_response_code(400);
        echo json_encode(["error" => "status_id, user_id, and reaction required"]);
        exit;
    }

    // Insert or update reaction
    $stmt = $conn->prepare("INSERT INTO status_reactions (status_id, user_id, reaction) 
                           VALUES (?, ?, ?) 
                           ON DUPLICATE KEY UPDATE reaction = ?");
    $stmt->bind_param("isss", $statusId, $userId, $reaction, $reaction);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "reaction" => $reaction]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Database error"]);
    }
    $stmt->close();
    exit;
}

// Remove Reaction
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'unreact') {
    $data = json_decode(file_get_contents("php://input"), true);
    $statusId = $data['status_id'] ?? null;
    $userId = $data['user_id'] ?? null;

    if (!$statusId || !$userId) {
        http_response_code(400);
        echo json_encode(["error" => "status_id and user_id required"]);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM status_reactions WHERE status_id = ? AND user_id = ?");
    $stmt->bind_param("is", $statusId, $userId);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Database error"]);
    }
    $stmt->close();
    exit;
}

// Get Reactions for Status
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'reactions') {
    $statusId = $_GET['status_id'] ?? null;

    if (!$statusId) {
        http_response_code(400);
        echo json_encode(["error" => "status_id required"]);
        exit;
    }

    $stmt = $conn->prepare("SELECT sr.*, u.first_name, u.last_name, u.photo_url 
                           FROM status_reactions sr
                           JOIN users u ON sr.user_id = u.user_id
                           WHERE sr.status_id = ?
                           ORDER BY sr.created_at DESC");
    $stmt->bind_param("i", $statusId);
    $stmt->execute();
    $result = $stmt->get_result();

    $reactions = [];
    while ($row = $result->fetch_assoc()) {
        $row['photo_url'] = normalizePhotoUrl($row['photo_url']);
        $reactions[] = $row;
    }
    $stmt->close();

    echo json_encode($reactions);
    exit;
}

// Reply to Status
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'reply') {
    $data = json_decode(file_get_contents("php://input"), true);
    $statusId = $data['status_id'] ?? null;
    $userId = $data['user_id'] ?? null;
    $message = $data['message'] ?? null;
    $replyType = $data['reply_type'] ?? 'text'; // text, emoji, sticker

    if (!$statusId || !$userId || !$message) {
        http_response_code(400);
        echo json_encode(["error" => "status_id, user_id, and message required"]);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO status_replies (status_id, user_id, message, reply_type) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isss", $statusId, $userId, $message, $replyType);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "reply_id" => $conn->insert_id]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Database error"]);
    }
    $stmt->close();
    exit;
}

// Get Replies for Status
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'replies') {
    $statusId = $_GET['status_id'] ?? null;

    if (!$statusId) {
        http_response_code(400);
        echo json_encode(["error" => "status_id required"]);
        exit;
    }

    $stmt = $conn->prepare("SELECT sr.*, u.first_name, u.last_name, u.photo_url 
                           FROM status_replies sr
                           JOIN users u ON sr.user_id = u.user_id
                           WHERE sr.status_id = ?
                           ORDER BY sr.created_at DESC");
    $stmt->bind_param("i", $statusId);
    $stmt->execute();
    $result = $stmt->get_result();

    $replies = [];
    while ($row = $result->fetch_assoc()) {
        $row['photo_url'] = normalizePhotoUrl($row['photo_url']);
        $replies[] = $row;
    }
    $stmt->close();

    echo json_encode($replies);
    exit;
}

// Fetch Feed
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'feed') {
    $currentUserId = $_GET['user_id'] ?? null;
    $yesterday = date('Y-m-d H:i:s', time() - 86400);

    // Get muted users for current user
    $mutedUsers = [];
    if ($currentUserId) {
        $muteStmt = $conn->prepare("SELECT muted_user_id FROM muted_statuses WHERE user_id = ?");
        $muteStmt->bind_param("s", $currentUserId);
        $muteStmt->execute();
        $muteResult = $muteStmt->get_result();
        while ($row = $muteResult->fetch_assoc()) {
            $mutedUsers[] = $row['muted_user_id'];
        }
        $muteStmt->close();
    }

    // Base query with prepared statement
    $stmt = $conn->prepare("SELECT s.*, u.first_name, u.last_name, u.photo_url as user_photo,
            (SELECT COUNT(*) FROM status_views sv WHERE sv.status_id = s.id) as view_count
            FROM status_updates s 
            JOIN users u ON s.user_id = u.user_id 
            WHERE s.created_at > ?
            ORDER BY s.created_at ASC");
    $stmt->bind_param("s", $yesterday);
    $stmt->execute();
    $result = $stmt->get_result();

    $feed = [];
    while ($row = $result->fetch_assoc()) {
        // Mark if muted (client can filter or show in separate section)
        $row['is_muted'] = in_array($row['user_id'], $mutedUsers);
        $row['user_photo'] = normalizePhotoUrl($row['user_photo']);
        $row['media_url'] = normalizePhotoUrl($row['media_url'] ?? null);
        $feed[] = $row;
    }
    $stmt->close();

    echo json_encode($feed);
    exit;
}

// Record View
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'view') {
    $data = json_decode(file_get_contents("php://input"), true);
    $statusId = $data['status_id'] ?? null;
    $viewerId = $data['viewer_id'] ?? null;

    if (!$statusId || !$viewerId) {
        http_response_code(400);
        echo json_encode(["error" => "status_id and viewer_id required"]);
        exit;
    }

    $stmt = $conn->prepare("INSERT IGNORE INTO status_views (status_id, viewer_id) VALUES (?, ?)");
    $stmt->bind_param("is", $statusId, $viewerId);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => "Database error"]);
    }
    $stmt->close();
    exit;
}

// Get Viewers
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'viewers') {
    $statusId = $_GET['status_id'] ?? null;

    if (!$statusId) {
        http_response_code(400);
        echo json_encode(["error" => "status_id required"]);
        exit;
    }

    $stmt = $conn->prepare("SELECT u.first_name, u.last_name, u.photo_url, sv.viewer_id, sv.viewed_at 
            FROM status_views sv
            JOIN users u ON sv.viewer_id = u.user_id
            WHERE sv.status_id = ?
            ORDER BY sv.viewed_at DESC");
    $stmt->bind_param("i", $statusId);
    $stmt->execute();
    $result = $stmt->get_result();

    $viewers = [];
    while ($row = $result->fetch_assoc()) {
        $row['photo_url'] = normalizePhotoUrl($row['photo_url']);
        $viewers[] = $row;
    }
    $stmt->close();

    echo json_encode($viewers);
    exit;
}

// Get Muted Users
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'muted') {
    $userId = $_GET['user_id'] ?? null;

    if (!$userId) {
        http_response_code(400);
        echo json_encode(["error" => "user_id required"]);
        exit;
    }

    $stmt = $conn->prepare("SELECT muted_user_id FROM muted_statuses WHERE user_id = ?");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $mutedUsers = [];
    while ($row = $result->fetch_assoc()) {
        $mutedUsers[] = $row['muted_user_id'];
    }
    $stmt->close();

    echo json_encode($mutedUsers);
    exit;
}

// Create Status
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid = $_POST['user_id'] ?? null;
    if (!$uid) {
        http_response_code(400);
        die(json_encode(["error" => "User ID required"]));
    }

    $type = $_POST['type'] ?? 'image'; // image, video, audio, text
    $privacy = $_POST['privacy'] ?? 'everyone';

    // Handle File Upload (Image/Video/Audio)
    if ($type !== 'text' && isset($_FILES['file'])) {
        $caption = $_POST['caption'] ?? '';
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

        $stmt = $conn->prepare("INSERT INTO status_updates (user_id, media_url, type, caption, privacy) 
                VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssss", $uid, $target_file, $type, $caption, $privacy);
    }
    // Handle Text Status
    else {
        $text_content = $_POST['text_content'] ?? '';
        $bg_color = $_POST['background_color'] ?? '#000000';
        $font = $_POST['font'] ?? 'sans-serif';
        $type = 'text'; // Enforce type

        $stmt = $conn->prepare("INSERT INTO status_updates (user_id, type, text_content, background_color, font, privacy, media_url) 
                VALUES (?, 'text', ?, ?, ?, ?, NULL)");
        $stmt->bind_param("sssss", $uid, $text_content, $bg_color, $font, $privacy);
    }

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "id" => $conn->insert_id]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Database error"]);
    }
    $stmt->close();
}
?>