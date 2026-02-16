<?php
// api/v4/groups/update_title.php
// Epic 43: Update Group Title (Admin Only)

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/group_auth.php';
// Epic 82: Group Admin Controls (Edit Info)
require_once __DIR__ . '/../../../includes/group_permission_enforcer.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    $input = json_decode(file_get_contents('php://input'), true);
    $groupId = $input['group_id'] ?? '';
    $title = trim($input['title'] ?? '');

    if (!$groupId || !$title) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_PARAMS']);
        exit;
    }

    if (strlen($title) > 60) {
        http_response_code(400);
        echo json_encode(['error' => 'TITLE_TOO_LONG', 'message' => 'Max 60 chars']);
        exit;
    }

    requireGroupAdmin($pdo, $groupId, $userId);

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("UPDATE `groups` SET title = ?, updated_at = NOW() WHERE group_id = ?");
    $stmt->execute([$title, $groupId]);

    logGroupAudit($pdo, $groupId, $userId, 'GROUP_TITLE_UPDATED', null, ['title' => $title]);

    $pdo->commit();

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
