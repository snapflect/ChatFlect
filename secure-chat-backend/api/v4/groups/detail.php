<?php
// api/v4/groups/detail.php
// Epic 41: Group Detail Endpoint

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/group_auth.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    $groupId = $_GET['group_id'] ?? '';

    if (!$groupId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_GROUP_ID', 'message' => 'group_id required']);
        exit;
    }

    // Verify membership
    requireGroupMember($pdo, $groupId, $userId);

    // Get group info
    $group = getActiveGroup($pdo, $groupId);
    if (!$group) {
        http_response_code(404);
        echo json_encode(['error' => 'GROUP_NOT_FOUND', 'message' => 'Group does not exist']);
        exit;
    }

    // Get members
    $stmt = $pdo->prepare("
        SELECT user_id, role, joined_at
        FROM group_members
        WHERE group_id = ? AND removed_at IS NULL
        ORDER BY role DESC, joined_at ASC
    ");
    $stmt->execute([$groupId]);
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'group' => [
            'group_id' => $group['group_id'],
            'title' => $group['title'],
            'created_by' => $group['created_by'],
            'created_at' => $group['created_at'],
            'updated_at' => $group['updated_at']
        ],
        'members' => $members,
        'my_role' => getGroupRole($pdo, $groupId, $userId)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
