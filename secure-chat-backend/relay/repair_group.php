<?php
// relay/repair_group.php
// Epic 42: Repair Group Messages (Gap Fill)

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../api/auth_middleware.php';
require_once __DIR__ . '/../includes/group_auth.php';
require_once __DIR__ . '/../includes/metrics.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    $groupId = $_GET['group_id'] ?? '';
    $startSeq = (int) ($_GET['start_seq'] ?? 0);
    $endSeq = (int) ($_GET['end_seq'] ?? 0);

    if (!$groupId || $startSeq <= 0 || $endSeq <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'INVALID_PARAMS', 'message' => 'group_id, start_seq, end_seq required']);
        exit;
    }

    // Max 500 messages per repair
    if ($endSeq - $startSeq > 500) {
        http_response_code(400);
        echo json_encode(['error' => 'RANGE_TOO_LARGE', 'message' => 'Max 500 messages per repair']);
        exit;
    }

    // Verify membership
    requireGroupMember($pdo, $groupId, $userId);

    // Fetch range
    $stmt = $pdo->prepare("
        SELECT message_uuid, sender_id, sender_device_uuid, server_seq, encrypted_payload, created_at
        FROM group_messages
        WHERE group_id = ? AND server_seq >= ? AND server_seq <= ?
        ORDER BY server_seq ASC
    ");
    $stmt->execute([$groupId, $startSeq, $endSeq]);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    incrementCounter($pdo, 'group_repair_requests_total');

    echo json_encode([
        'success' => true,
        'group_id' => $groupId,
        'messages' => $messages,
        'start_seq' => $startSeq,
        'end_seq' => $endSeq,
        'count' => count($messages)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
