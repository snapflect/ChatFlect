<?php
// api/v4/groups/demote_admin.php
// Epic 43: Demote Admin (Owner Only)

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

    // Only owner can demote
    requireGroupOwner($pdo, $groupId, $userId);

    $targetRole = getMemberRole($pdo, $groupId, $targetUserId);
    if ($targetRole === 'owner') {
        http_response_code(403);
        echo json_encode(['error' => 'CANNOT_DEMOTE_OWNER']);
        exit;
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?");
    $stmt->execute([$groupId, $targetUserId]);

    logGroupAudit($pdo, $groupId, $userId, 'ROLE_CHANGED', $targetUserId, ['new_role' => 'member']);

    $pdo->commit();

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
