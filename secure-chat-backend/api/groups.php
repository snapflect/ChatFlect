<?php
require 'db.php';
$data = json_decode(file_get_contents("php://input"), true);

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
    return 'serve.php?file=' . ltrim($photoUrl, '/');
}

// Create Group
if (isset($data['action']) && $data['action'] === 'create') {
    $name = $data['name'] ?? '';
    $creator = $data['created_by'] ?? '';
    $members = $data['members'] ?? []; // Array

    // Validate Limits
    if (count($members) > 256) {
        echo json_encode(["error" => "Group limit exceeded (Max 256 members)"]);
        exit;
    }

    $group_id = uniqid('group_');

    // Create Group
    $stmt = $conn->prepare("INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $group_id, $name, $creator);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to create group"]);
        exit;
    }
    $stmt->close();

    // Add Creator as Admin
    $stmt = $conn->prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')");
    $stmt->bind_param("ss", $group_id, $creator);
    $stmt->execute();
    $stmt->close();

    // Add Members
    $stmt = $conn->prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')");
    foreach ($members as $m) {
        $stmt->bind_param("ss", $group_id, $m);
        $stmt->execute();
    }
    $stmt->close();

    echo json_encode(["status" => "success", "group_id" => $group_id]);
    exit;
}

// Promote to Admin
if (isset($data['action']) && $data['action'] === 'promote_admin') {
    $groupId = $data['group_id'] ?? '';
    $userId = $data['user_id'] ?? '';

    $stmt = $conn->prepare("UPDATE group_members SET role='admin' WHERE group_id=? AND user_id=?");
    $stmt->bind_param("ss", $groupId, $userId);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => "Failed to promote user"]);
    }
    $stmt->close();
    exit;
}

// Update Group Name
if (isset($data['action']) && $data['action'] === 'update_group') {
    $groupId = $data['group_id'] ?? '';
    $name = $data['name'] ?? '';

    $stmt = $conn->prepare("UPDATE groups SET name=? WHERE id=?");
    $stmt->bind_param("ss", $name, $groupId);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => "Failed to update group"]);
    }
    $stmt->close();
    exit;
}

// Get Group Members
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['group_id'])) {
    $groupId = $_GET['group_id'];

    $stmt = $conn->prepare("SELECT u.user_id, u.first_name, u.last_name, u.photo_url, gm.role 
            FROM group_members gm 
            JOIN users u ON gm.user_id = u.user_id 
            WHERE gm.group_id = ?");
    $stmt->bind_param("s", $groupId);
    $stmt->execute();
    $result = $stmt->get_result();

    $members = [];
    while ($row = $result->fetch_assoc()) {
        $row['photo_url'] = normalizePhotoUrl($row['photo_url']);
        $members[] = $row;
    }
    echo json_encode($members);
    $stmt->close();
    exit;
}
?>