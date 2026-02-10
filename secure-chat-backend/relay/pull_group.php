<?php
// relay/pull_group.php (v2)
// Epic 45: Pull Group Messages + Receipts

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
    $sinceReceiptId = (int) ($_GET['since_receipt_id'] ?? 0); // New for Epic 45
    $limit = min((int) ($_GET['limit'] ?? 50), 200);

    if (!$groupId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_GROUP_ID']);
        exit;
    }

    requireGroupMember($pdo, $groupId, $userId);

    // 1. Fetch Messages
    $stmt = $pdo->prepare("
        SELECT message_uuid, sender_id, sender_device_uuid, server_seq, encrypted_payload, created_at
        FROM group_messages
        WHERE group_id = ? AND server_seq > ?
        ORDER BY server_seq ASC
        LIMIT ?
    ");
    $stmt->execute([$groupId, $sinceSeq, $limit]);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $lastSeq = $sinceSeq;
    if (!empty($messages)) {
        $lastSeq = (int) $messages[count($messages) - 1]['server_seq'];
    }

    // 2. Fetch Receipts (Epic 45)
    $stmtReceipts = $pdo->prepare("
        SELECT receipt_id, message_uuid, user_id, device_uuid, type, created_at
        FROM group_receipts
        WHERE group_id = ? AND receipt_id > ?
        ORDER BY receipt_id ASC
        LIMIT ?
    ");
    $stmtReceipts->execute([$groupId, $sinceReceiptId, $limit]);
    $receipts = $stmtReceipts->fetchAll(PDO::FETCH_ASSOC);

    $lastReceiptId = $sinceReceiptId;
    if (!empty($receipts)) {
        $lastReceiptId = (int) $receipts[count($receipts) - 1]['receipt_id'];
    }

    $hasMore = (count($messages) === $limit) || (count($receipts) === $limit);

    $latency = (microtime(true) - $startTime) * 1000;
    recordMetric($pdo, 'pull_group_v2', $latency, 200);

    echo json_encode([
        'success' => true,
        'group_id' => $groupId,
        'messages' => $messages,
        'receipts' => $receipts,
        'last_seq' => $lastSeq,
        'last_receipt_id' => $lastReceiptId,
        'has_more' => $hasMore
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
