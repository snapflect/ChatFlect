<?php
// api/v4/groups/add_member.php
// Epic 43: Add Member (Admin Only)

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/group_auth.php';
require_once __DIR__ . '/../../../includes/rate_limiter.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    // Rate limit: 10 per 10 min
    checkRateLimit($pdo, $userId, 'group_admin_action', 10, 600);

    $input = json_decode(file_get_contents('php://input'), true);
    $groupId = $input['group_id'] ?? '';
    $newMemberId = strtoupper($input['user_id'] ?? '');

    if (!$groupId || !$newMemberId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_PARAMS', 'message' => 'group_id and user_id required']);
        exit;
    }

    // Verify admin/owner
    requireGroupAdmin($pdo, $groupId, $userId);

    $pdo->beginTransaction();

    // Check max size
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND removed_at IS NULL");
    $stmt->execute([$groupId]);
    $count = $stmt->fetchColumn();

    if ($count >= 50) {
        throw new Exception('MAX_MEMBERS_REACHED');
    }

    // Check if already member
    $stmt = $pdo->prepare("SELECT removed_at FROM group_members WHERE group_id = ? AND user_id = ?");
    $stmt->execute([$groupId, $newMemberId]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing && $existing['removed_at'] === null) {
        // Already active
        $pdo->rollBack();
        echo json_encode(['success' => true, 'message' => 'User already a member']);
        exit;
    }

    if ($existing) {
        // Re-add (soft delete undo)
        $stmt = $pdo->prepare("UPDATE group_members SET removed_at = NULL, role = 'member', added_by = ?, joined_at = NOW() WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$userId, $groupId, $newMemberId]);
    } else {
        // New insert
        $stmt = $pdo->prepare("INSERT INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, 'member', ?)");
        $stmt->execute([$groupId, $newMemberId, $userId]);
    }

    // Log
    logGroupAudit($pdo, $groupId, $userId, 'MEMBER_ADDED', $newMemberId);

    $pdo->commit();

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
