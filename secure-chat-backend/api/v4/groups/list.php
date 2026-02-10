<?php
// api/v4/groups/list.php
// Epic 41: List User's Groups

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    $stmt = $pdo->prepare("
        SELECT 
            g.group_id,
            g.title,
            g.updated_at,
            gm.role,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.group_id AND removed_at IS NULL) as member_count
        FROM `groups` g
        JOIN group_members gm ON g.group_id = gm.group_id
        WHERE gm.user_id = ? AND gm.removed_at IS NULL AND g.is_active = 1
        ORDER BY g.updated_at DESC
    ");
    $stmt->execute([$userId]);
    $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'groups' => $groups
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
