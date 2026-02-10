<?php
// relay/receipt_group.php
// Epic 45: Group Receipts Endpoint

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../api/auth_middleware.php';
require_once __DIR__ . '/../includes/group_auth.php';
require_once __DIR__ . '/../includes/rate_limiter.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);
    $deviceUuid = $authData['device_uuid'] ?? '';

    // Rate limit
    checkRateLimit($pdo, $userId, 'receipt_upload', 100, 60);

    $input = json_decode(file_get_contents('php://input'), true);
    $groupId = $input['group_id'] ?? '';
    $receipts = $input['receipts'] ?? []; // Array of {message_uuid, type}

    if (!$groupId || empty($receipts)) {
        http_response_code(400);
        echo json_encode(['error' => 'INVALID_PARAMS']);
        exit;
    }

    // Verify membership
    requireGroupMember($pdo, $groupId, $userId);

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO group_receipts (group_id, message_uuid, user_id, device_uuid, type)
        VALUES (?, ?, ?, ?, ?)
    ");

    $count = 0;
    foreach ($receipts as $r) {
        $msgUuid = $r['message_uuid'] ?? '';
        $type = $r['type'] ?? '';

        if ($msgUuid && in_array($type, ['DELIVERED', 'READ'])) {
            $stmt->execute([$groupId, $msgUuid, $userId, $deviceUuid, $type]);
            $count += $stmt->rowCount();
        }
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'count' => $count]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
