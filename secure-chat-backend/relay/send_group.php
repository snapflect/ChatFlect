<?php
// relay/send_group.php
// Epic 42: Send Group Message Endpoint

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../api/auth_middleware.php';
require_once __DIR__ . '/../includes/group_auth.php';
require_once __DIR__ . '/../includes/rate_limiter.php';
require_once __DIR__ . '/../includes/abuse_detector.php';
require_once __DIR__ . '/../includes/logger.php';
require_once __DIR__ . '/../includes/metrics.php';

header('Content-Type: application/json');
$startTime = microtime(true);

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);
    $deviceUuid = $authData['device_uuid'] ?? '';

    // Rate limit: 30 per minute per user
    checkRateLimit($pdo, $userId, 'group_send', 30, 60);

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'INVALID_REQUEST']);
        exit;
    }

    $groupId = $input['group_id'] ?? '';
    $messageUuid = $input['message_uuid'] ?? '';
    $encryptedPayload = $input['encrypted_payload'] ?? '';

    // Validation
    if (!$groupId || !$messageUuid || !$encryptedPayload) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_FIELDS', 'message' => 'group_id, message_uuid, encrypted_payload required']);
        exit;
    }

    // Verify membership
    requireGroupMember($pdo, $groupId, $userId);

    // Abuse check
    recordMessageEvent($pdo, $userId, strlen($encryptedPayload));
    $abuseScore = getAbuseScore($pdo, $userId);
    if ($abuseScore > 80) {
        http_response_code(429);
        echo json_encode(['error' => 'ABUSE_DETECTED']);
        exit;
    }

    // Check for duplicate (idempotency)
    $stmt = $pdo->prepare("SELECT server_seq FROM group_messages WHERE message_uuid = ?");
    $stmt->execute([$messageUuid]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        echo json_encode([
            'success' => true,
            'duplicate' => true,
            'group_id' => $groupId,
            'message_uuid' => $messageUuid,
            'server_seq' => (int) $existing['server_seq']
        ]);
        exit;
    }

    // Get next sequence with lock
    $pdo->beginTransaction();

    // Ensure sequence row exists
    $pdo->exec("INSERT IGNORE INTO group_sequences (group_id, last_seq) VALUES ('$groupId', 0)");

    // Lock and increment
    $stmt = $pdo->prepare("SELECT last_seq FROM group_sequences WHERE group_id = ? FOR UPDATE");
    $stmt->execute([$groupId]);
    $seqRow = $stmt->fetch(PDO::FETCH_ASSOC);
    $newSeq = ($seqRow['last_seq'] ?? 0) + 1;

    $stmt = $pdo->prepare("UPDATE group_sequences SET last_seq = ? WHERE group_id = ?");
    $stmt->execute([$newSeq, $groupId]);

    // Insert message
    $stmt = $pdo->prepare("
        INSERT INTO group_messages (group_id, message_uuid, sender_id, sender_device_uuid, server_seq, encrypted_payload)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$groupId, $messageUuid, $userId, $deviceUuid, $newSeq, $encryptedPayload]);

    $pdo->commit();

    // Update group timestamp
    $pdo->prepare("UPDATE `groups` SET updated_at = NOW() WHERE group_id = ?")->execute([$groupId]);

    // Metrics
    $latency = (microtime(true) - $startTime) * 1000;
    recordMetric($pdo, 'send_group', $latency, 200);
    incrementCounter($pdo, 'group_messages_sent_total');

    echo json_encode([
        'success' => true,
        'group_id' => $groupId,
        'message_uuid' => $messageUuid,
        'server_seq' => $newSeq,
        'server_received_at' => date('c')
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
