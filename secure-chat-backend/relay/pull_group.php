<?php
// relay/pull_group.php
// Epic 42: Pull Group Messages Endpoint

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../api/auth_middleware.php';
require_once __DIR__ . '/../includes/group_auth.php';
require_once __DIR__ . '/../includes/metrics.php';

header('Content-Type: application/json');
$startTime = microtime(true);

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    $groupId = $_GET['group_id'] ?? '';
    $sinceSeq = (int) ($_GET['since_seq'] ?? 0);
    $limit = min((int) ($_GET['limit'] ?? 50), 200);

    if (!$groupId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_GROUP_ID']);
        exit;
    }

    // Verify membership
    requireGroupMember($pdo, $groupId, $userId);

    // Fetch messages
    $stmt = $pdo->prepare("
        SELECT message_uuid, sender_id, sender_device_uuid, server_seq, encrypted_payload, created_at
        FROM group_messages
        WHERE group_id = ? AND server_seq > ?
        ORDER BY server_seq ASC
        LIMIT ?
    ");
    $stmt->execute([$groupId, $sinceSeq, $limit]);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get last seq
    $lastSeq = $sinceSeq;
    if (!empty($messages)) {
        $lastSeq = (int) $messages[count($messages) - 1]['server_seq'];
    }

    // Check if more
    $hasMore = count($messages) === $limit;

    // Metrics
    $latency = (microtime(true) - $startTime) * 1000;
    recordMetric($pdo, 'pull_group', $latency, 200);

    echo json_encode([
        'success' => true,
        'group_id' => $groupId,
        'messages' => $messages,
        'last_seq' => $lastSeq,
        'has_more' => $hasMore,
        'count' => count($messages)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
