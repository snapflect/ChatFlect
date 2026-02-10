<?php
// api/v4/groups/remove_member.php
// Epic 43: Remove Member (Admin Only)

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/group_auth.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    $input = json_decode(file_get_contents('php://input'), true);
    $groupId = $input['group_id'] ?? '';
    $targetUserId = strtoupper($input['user_id'] ?? '');

    if (!$groupId || !$targetUserId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_PARAMS']);
        exit;
    }

    // Verify admin
    requireGroupAdmin($pdo, $groupId, $userId);

    $myRole = getMemberRole($pdo, $groupId, $userId);
    $targetRole = getMemberRole($pdo, $groupId, $targetUserId);

    if (!$targetRole) {
        http_response_code(404);
        echo json_encode(['error' => 'USER_NOT_MEMBER']);
        exit;
    }

    // Protect owner
    if ($targetRole === 'owner') {
        http_response_code(403);
        echo json_encode(['error' => 'CANNOT_REMOVE_OWNER']);
        exit;
    }

    // Admin cannot remove other admin (unless owner)
    if ($targetRole === 'admin' && $myRole !== 'owner') {
        http_response_code(403);
        echo json_encode(['error' => 'ADMIN_CANNOT_REMOVE_ADMIN']);
        exit;
    }

    $pdo->beginTransaction();

    // Soft remove
    $stmt = $pdo->prepare("UPDATE group_members SET removed_at = NOW() WHERE group_id = ? AND user_id = ?");
    $stmt->execute([$groupId, $targetUserId]);

    logGroupAudit($pdo, $groupId, $userId, 'MEMBER_REMOVED', $targetUserId);

    $pdo->commit();

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
