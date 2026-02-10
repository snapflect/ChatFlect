<?php
// api/v4/groups/create.php
// Epic 41: Create Group Endpoint

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/group_auth.php';
require_once __DIR__ . '/../../../includes/rate_limiter.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    // Rate limit: 5 per 10 min
    checkRateLimit($pdo, $userId, 'group_create', 5, 600);

    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'INVALID_REQUEST', 'message' => 'Request body required']);
        exit;
    }

    $title = trim($input['title'] ?? '');
    $members = $input['members'] ?? [];

    // Validation
    if (strlen($title) < 1 || strlen($title) > 200) {
        http_response_code(400);
        echo json_encode(['error' => 'INVALID_TITLE', 'message' => 'Title must be 1-200 characters']);
        exit;
    }

    if (!is_array($members)) {
        http_response_code(400);
        echo json_encode(['error' => 'INVALID_MEMBERS', 'message' => 'Members must be an array']);
        exit;
    }

    // Normalize members to uppercase
    $members = array_map('strtoupper', $members);

    // Remove duplicates and creator
    $members = array_unique($members);
    $members = array_filter($members, fn($m) => $m !== $userId);

    if (count($members) > 50) {
        http_response_code(400);
        echo json_encode(['error' => 'TOO_MANY_MEMBERS', 'message' => 'Maximum 50 members allowed']);
        exit;
    }

    // Generate group ID
    $groupId = generateGroupId();

    $pdo->beginTransaction();

    // Create group
    $stmt = $pdo->prepare("INSERT INTO `groups` (group_id, created_by, title) VALUES (?, ?, ?)");
    $stmt->execute([$groupId, $userId, $title]);

    // Add creator as admin
    $stmt = $pdo->prepare("INSERT INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, 'admin', ?)");
    $stmt->execute([$groupId, $userId, $userId]);

    // Add members
    $memberStmt = $pdo->prepare("INSERT INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, 'member', ?)");
    foreach ($members as $member) {
        $memberStmt->execute([$groupId, $member, $userId]);
    }

    // Audit logs
    logGroupAudit($pdo, $groupId, $userId, 'GROUP_CREATED', null, ['title' => $title]);
    foreach ($members as $member) {
        logGroupAudit($pdo, $groupId, $userId, 'MEMBER_ADDED', $member);
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'group_id' => $groupId,
        'member_count' => count($members) + 1
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
