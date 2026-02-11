<?php
// api/v4/groups/approve_join.php
// Admin approves or rejects join request.

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/group_permission_enforcer.php';

header('Content-Type: application/json');

$authData = requireAuth();
$userId = $authData['user_id'];
$input = json_decode(file_get_contents('php://input'), true);

$reqId = $input['request_id'];
$action = $input['action']; // APPROVED / REJECTED

if (!in_array($action, ['APPROVED', 'REJECTED'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
    exit;
}

// Fetch Request Info
$stmt = $pdo->prepare("SELECT group_id, user_id, status FROM group_join_requests WHERE request_id = ?");
$stmt->execute([$reqId]);
$req = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$req || $req['status'] !== 'PENDING') {
    http_response_code(404);
    echo json_encode(['error' => 'Request not found or processed']);
    exit;
}

$groupId = $req['group_id'];
$targetUserId = $req['user_id'];

// Check Admin Permissions
$gpe = new GroupPermissionEnforcer($pdo);
// Only admins can approve? "only_admins_add_users" might control this, or ALL admins by default.
// Let's assume ANY admin can approve.
// We can reuse `canAddParticipants` logic or just check isAdmin directly.
// Ideally consistent with 'add members' right? If only admins can add, only admins can approve.
if (!$gpe->canAddParticipants($groupId, $userId)) {
    http_response_code(403);
    echo json_encode(['error' => 'Not authorized to approve requests']);
    exit;
}

$pdo->beginTransaction();

try {
    // 1. Update Request
    $upd = $pdo->prepare("UPDATE group_join_requests SET status = ?, processed_at = NOW(), processed_by = ? WHERE request_id = ?");
    $upd->execute([$action, $userId, $reqId]);

    // 2. If Approved, Add Member
    if ($action === 'APPROVED') {
        $add = $pdo->prepare("INSERT INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, 'member', ?)");
        $add->execute([$groupId, $targetUserId, $userId]);

        // Log Audit from Enforcer? 
        $gpe->logAction($groupId, $userId, 'APPROVE_JOIN', ['target' => $targetUserId]);
    } else {
        $gpe->logAction($groupId, $userId, 'REJECT_JOIN', ['target' => $targetUserId]);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
