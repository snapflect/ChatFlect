<?php
// api/v4/groups/leave.php
// Epic 43: Leave Group (Auto Ownership Transfer)

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/group_auth.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    $input = json_decode(file_get_contents('php://input'), true);
    $groupId = $input['group_id'] ?? '';

    if (!$groupId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_GROUP_ID']);
        exit;
    }

    requireGroupMember($pdo, $groupId, $userId);

    $myRole = getMemberRole($pdo, $groupId, $userId);

    $pdo->beginTransaction();

    // Soft remove self
    $stmt = $pdo->prepare("UPDATE group_members SET removed_at = NOW() WHERE group_id = ? AND user_id = ?");
    $stmt->execute([$groupId, $userId]);

    logGroupAudit($pdo, $groupId, $userId, 'MEMBER_LEFT');

    // If owner left, transfer ownership
    if ($myRole === 'owner') {
        // Find oldest active admin
        $stmt = $pdo->prepare("
            SELECT user_id FROM group_members 
            WHERE group_id = ? AND removed_at IS NULL AND role = 'admin'
            ORDER BY joined_at ASC LIMIT 1
        ");
        $stmt->execute([$groupId]);
        $newOwner = $stmt->fetchColumn();

        // If no admin, find oldest member
        if (!$newOwner) {
            $stmt = $pdo->prepare("
                SELECT user_id FROM group_members 
                WHERE group_id = ? AND removed_at IS NULL AND role = 'member'
                ORDER BY joined_at ASC LIMIT 1
            ");
            $stmt->execute([$groupId]);
            $newOwner = $stmt->fetchColumn();
        }

        if ($newOwner) {
            // Transfer
            $stmt = $pdo->prepare("UPDATE `groups` SET created_by = ? WHERE group_id = ?");
            $stmt->execute([$newOwner, $groupId]);

            // Promote to admin if logic requires (though 'owner' is implicitly admin)
            // Ideally ensure they have admin role too, just in case
            $stmt = $pdo->prepare("UPDATE group_members SET role = 'admin' WHERE group_id = ? AND user_id = ?");
            $stmt->execute([$groupId, $newOwner]);

            logGroupAudit($pdo, $groupId, $userId, 'OWNERSHIP_TRANSFERRED', $newOwner);
        } else {
            // Group empty - mark inactive
            $stmt = $pdo->prepare("UPDATE `groups` SET is_active = 0 WHERE group_id = ?");
            $stmt->execute([$groupId]);
            logGroupAudit($pdo, $groupId, $userId, 'GROUP_ARCHIVED', null, ['reason' => 'last_member_left']);
        }
    }

    $pdo->commit();

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
