<?php
require 'db.php';
require_once 'rate_limiter.php';
require_once 'auth_middleware.php';

// Enforce rate limiting
enforceRateLimit();

$data = json_decode(file_get_contents("php://input"), true);

/* ---------- URL NORMALIZATION HELPERS ---------- */
// --- Helper: Ensure Invite Code Column Exists ---
function ensureInviteCodeColumn($conn)
{
    // Check if column exists
    $check = $conn->query("SHOW COLUMNS FROM groups LIKE 'invite_code'");
    if ($check && $check->num_rows == 0) {
        // Add it
        $conn->query("ALTER TABLE groups ADD COLUMN invite_code VARCHAR(10) UNIQUE DEFAULT NULL");
    }
}

// --- ACTIONS ---

// Create Group
if (isset($data['action']) && $data['action'] === 'create') {
    // Require authentication
    $authUserId = requireAuth();

    // Sanitize inputs
    $name = sanitizeString($data['name'] ?? '', 100);
    $creator = sanitizeUserId($data['created_by'] ?? '');
    $members = $data['members'] ?? []; // Array

    // Validate creator matches authenticated user
    if ($creator !== $authUserId) {
        http_response_code(403);
        echo json_encode(["error" => "Cannot create group for another user"]);
        exit;
    }

    if (count($members) > 256) {
        echo json_encode(["error" => "Group limit exceeded (Max 256 members)"]);
        exit;
    }

    $group_id = uniqid('group_');

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

    // Add Members (sanitize each member ID)
    $stmt = $conn->prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')");
    foreach ($members as $m) {
        $sanitizedMember = sanitizeUserId($m);
        if ($sanitizedMember) {
            $stmt->bind_param("ss", $group_id, $sanitizedMember);
            $stmt->execute();
        }
    }
    $stmt->close();

    // Audit log
    auditLog(AUDIT_GROUP_CREATE, $creator, ['group_id' => $group_id, 'name' => $name]);

    echo json_encode(["status" => "success", "group_id" => $group_id]);
    exit;
}

// Add Member
if (isset($data['action']) && $data['action'] === 'add_member') {
    $groupId = $data['group_id'] ?? '';
    $userId = $data['user_id'] ?? '';

    $stmt = $conn->prepare("INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')");
    $stmt->bind_param("ss", $groupId, $userId);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => "Failed to add member"]);
    }
    $stmt->close();
    exit;
}

// Remove Member (Admin Only Logic should be enforced in Frontend or here by checking requester)
// For simplicity assuming frontend checks 'iAmAdmin'
if (isset($data['action']) && $data['action'] === 'remove_member') {
    $groupId = $data['group_id'] ?? '';
    $targetId = $data['target_id'] ?? '';

    $stmt = $conn->prepare("DELETE FROM group_members WHERE group_id=? AND user_id=?");
    $stmt->bind_param("ss", $groupId, $targetId);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => "Failed to remove member"]);
    }
    $stmt->close();
    exit;
}

// Leave Group
if (isset($data['action']) && $data['action'] === 'leave') {
    $groupId = $data['group_id'] ?? '';
    $userId = $data['user_id'] ?? '';

    $stmt = $conn->prepare("DELETE FROM group_members WHERE group_id=? AND user_id=?");
    $stmt->bind_param("ss", $groupId, $userId);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => "Failed to leave group"]);
    }
    $stmt->close();
    exit;
}

// Promote/Demote
if (isset($data['action']) && ($data['action'] === 'promote' || $data['action'] === 'demote')) {
    $groupId = $data['group_id'] ?? '';
    $targetId = $data['target_id'] ?? '';
    $role = ($data['action'] === 'promote') ? 'admin' : 'member';

    $stmt = $conn->prepare("UPDATE group_members SET role=? WHERE group_id=? AND user_id=?");
    $stmt->bind_param("sss", $role, $groupId, $targetId);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["error" => "Failed to update role"]);
    }
    $stmt->close();
    exit;
}

// Get Invite Code
if (isset($data['action']) && $data['action'] === 'get_invite_code') {
    $groupId = $data['group_id'] ?? '';
    ensureInviteCodeColumn($conn);

    // Fetch existing
    $stmt = $conn->prepare("SELECT invite_code FROM groups WHERE id=?");
    $stmt->bind_param("s", $groupId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();

    if ($row && !empty($row['invite_code'])) {
        echo json_encode(["status" => "success", "invite_code" => $row['invite_code']]);
    } else {
        // Generate new
        $code = substr(md5(uniqid($groupId, true)), 0, 8);
        $stmt = $conn->prepare("UPDATE groups SET invite_code=? WHERE id=?");
        $stmt->bind_param("ss", $code, $groupId);
        $stmt->execute();
        echo json_encode(["status" => "success", "invite_code" => $code]);
    }
    exit;
}

// Regenerate Invite Code
if (isset($data['action']) && $data['action'] === 'regenerate_invite_code') {
    $groupId = $data['group_id'] ?? '';
    ensureInviteCodeColumn($conn);

    $code = substr(md5(uniqid($groupId, true)), 0, 8);
    $stmt = $conn->prepare("UPDATE groups SET invite_code=? WHERE id=?");
    $stmt->bind_param("ss", $code, $groupId);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "invite_code" => $code]);
    } else {
        echo json_encode(["error" => "Failed to regenerate code"]);
    }
    exit;
}

// Join via Code
if (isset($data['action']) && $data['action'] === 'join_via_code') {
    $code = $data['code'] ?? '';
    $userId = $data['user_id'] ?? '';
    ensureInviteCodeColumn($conn);

    // Find Group
    $stmt = $conn->prepare("SELECT id, name FROM groups WHERE invite_code=?");
    $stmt->bind_param("s", $code);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($row = $res->fetch_assoc()) {
        $groupId = $row['id'];

        // Add to members
        $stmt2 = $conn->prepare("INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')");
        $stmt2->bind_param("ss", $groupId, $userId);
        $stmt2->execute();

        echo json_encode(["status" => "success", "group_id" => $groupId, "group_name" => $row['name']]);
    } else {
        echo json_encode(["error" => "Invalid invite code"]);
    }
    exit;
}

// Update Group Name (Previously update_group)
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

    $stmt = $conn->prepare("SELECT u.user_id, u.first_name, u.last_name, u.photo_url, u.phone_number, gm.role 
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