<?php
require 'db.php';
$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['action']) && $data['action'] === 'create') {
    $name = $conn->real_escape_string($data['name']);
    $creator = $conn->real_escape_string($data['created_by']);
    $members = $data['members']; // Array

    $group_id = uniqid('group_');

    // 1. Create Group
    $sql1 = "INSERT INTO groups (id, name, created_by) VALUES ('$group_id', '$name', '$creator')";
    $conn->query($sql1);

    // 2. Add Creator
    $conn->query("INSERT INTO group_members (group_id, user_id, role) VALUES ('$group_id', '$creator', 'admin')");

    // 3. Add Members
    foreach ($members as $m) {
        $uid = $conn->real_escape_string($m);
        $conn->query("INSERT INTO group_members (group_id, user_id, role) VALUES ('$group_id', '$uid', 'member')");
    }

    echo json_encode(["status" => "success", "group_id" => $group_id]);
    exit;
}

if (isset($data['action']) && $data['action'] === 'promote_admin') {
    $groupId = $conn->real_escape_string($data['group_id']);
    $userId = $conn->real_escape_string($data['user_id']);

    $sql = "UPDATE group_members SET role='admin' WHERE group_id='$groupId' AND user_id='$userId'";
    if ($conn->query($sql)) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => $conn->error]);
    }
    exit;
}

if (isset($data['action']) && $data['action'] === 'update_group') {
    $groupId = $conn->real_escape_string($data['group_id']);
    $name = $conn->real_escape_string($data['name']);

    $sql = "UPDATE groups SET name='$name' WHERE id='$groupId'";
    if ($conn->query($sql)) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => $conn->error]);
    }
    exit;
    exit;
}

if (isset($data['action']) && $data['action'] === 'update_settings') {
    $groupId = $conn->real_escape_string($data['group_id']);
    $settings = $conn->real_escape_string(json_encode($data['settings'])); // e.g. {"only_admins_send": true}

    $sql = "UPDATE groups SET settings='$settings' WHERE id='$groupId'";
    if ($conn->query($sql)) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => $conn->error]);
    }
    exit;
}

if (isset($data['action']) && $data['action'] === 'get_invite_code') {
    $groupId = $conn->real_escape_string($data['group_id']);

    // Check if code exists
    $res = $conn->query("SELECT invite_code FROM groups WHERE id='$groupId'");
    $row = $res->fetch_assoc();

    if ($row && $row['invite_code']) {
        echo json_encode(["status" => "success", "invite_code" => $row['invite_code']]);
    } else {
        // Generate new
        $code = substr(md5(uniqid()), 0, 8);
        $conn->query("UPDATE groups SET invite_code='$code' WHERE id='$groupId'");
        echo json_encode(["status" => "success", "invite_code" => $code]);
    }
    exit;
}

if (isset($data['action']) && $data['action'] === 'join_via_code') {
    $code = $conn->real_escape_string($data['invite_code']);
    $userId = $conn->real_escape_string($data['user_id']);

    // Find Group
    $res = $conn->query("SELECT id FROM groups WHERE invite_code='$code'");
    $row = $res->fetch_assoc();

    if ($row) {
        $groupId = $row['id'];
        // Add Member (Ignore if already exists via IGNORE)
        $sql = "INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES ('$groupId', '$userId', 'member')";
        if ($conn->query($sql)) {
            echo json_encode(["status" => "success", "group_id" => $groupId]);
        } else {
            echo json_encode(["error" => $conn->error]);
        }
    } else {
        echo json_encode(["error" => "Invalid Quote"]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['group_id'])) {
    $groupId = $conn->real_escape_string($_GET['group_id']);

    // Get Members
    $sql = "SELECT u.user_id, u.first_name, u.last_name, u.photo_url, gm.role 
            FROM group_members gm 
            JOIN users u ON gm.user_id = u.user_id 
            WHERE gm.group_id = '$groupId'";

    $result = $conn->query($sql);
    $members = [];
    while ($row = $result->fetch_assoc()) {
        $members[] = $row;
    }
    echo json_encode($members);
    exit;
}
?>