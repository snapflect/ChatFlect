<?php
// api/v4/groups/join.php
// Request to join a group (if approval required) or join if open.

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';

header('Content-Type: application/json');

$authData = requireAuth(); // Assumes this fn exists from previous files
$userId = $authData['user_id'];
$input = json_decode(file_get_contents('php://input'), true);
$groupId = hex2bin($input['group_id']);

// Check if group exists and setting
$stmt = $pdo->prepare("SELECT approval_required_to_join FROM `groups` WHERE group_id = ?");
$stmt->execute([$groupId]);
$setting = $stmt->fetchColumn();

if ($setting === false) {
    http_response_code(404);
    echo json_encode(['error' => 'Group not found']);
    exit;
}

// Epic 82: Check Approval Requirement
if ($setting == 1) {
    // Insert Request
    try {
        $req = $pdo->prepare("INSERT INTO group_join_requests (group_id, user_id, status) VALUES (?, ?, 'PENDING')");
        $req->execute([$groupId, $userId]);
        echo json_encode(['success' => true, 'status' => 'PENDING', 'message' => 'Request sent to admins']);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['success' => true, 'status' => 'PENDING', 'message' => 'Request already pending']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
    exit;
}

// Logic for Open Join (Simplified Mock)
// call add_member logic internally or just insert
try {
    $add = $pdo->prepare("INSERT INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, 'member', ?)");
    $add->execute([$groupId, $userId, $userId]); // Added by self
    echo json_encode(['success' => true, 'status' => 'JOINED']);
} catch (Exception $e) {
    // Handle duplicate etc
    echo json_encode(['success' => true, 'status' => 'JOINED', 'message' => 'Already member']);
}
