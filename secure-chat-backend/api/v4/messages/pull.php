<?php
// api/v4/messages/pull.php
// Epic 48: Device-Specific Message Pull

require_once __DIR__ . '/../../db_connect.php';
require_once __DIR__ . '/../../auth_middleware.php';
require_once __DIR__ . '/../../../includes/rate_limiter.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);
    $deviceId = $authData['device_uuid'] ?? '';

    // Enforce Invariant: Revoked devices cannot pull
    // requireAuth() should handle this, but explicit check acts as defense-in-depth
    $stmt = $conn->prepare("SELECT status FROM user_devices WHERE device_uuid = ?");
    $stmt->bind_param("s", $deviceId);
    $stmt->execute();
    $resStatus = $stmt->get_result();

    if ($resStatus->num_rows === 0) {
        http_response_code(403);
        echo json_encode(['error' => 'DEVICE_NOT_FOUND']);
        exit;
    }

    $statusRow = $resStatus->fetch_assoc();
    if ($statusRow['status'] !== 'active') {
        http_response_code(403);
        echo json_encode(['error' => 'DEVICE_NOT_TRUSTED']);
        exit;
    }

    $limit = 50;

    // Hardening: Explicitly bind query to auth token's device_id
    // Epic 84: Join messages to expose forwarding_score
    $sql = "
        SELECT 
            di.inbox_id, 
            di.message_uuid, 
            di.encrypted_payload, 
            di.nonce, 
            di.created_at,
            m.forwarding_score
        FROM device_inbox di
        LEFT JOIN messages m ON UNHEX(REPLACE(di.message_uuid, '-', '')) = m.message_id
        WHERE di.recipient_device_id = ?
          AND di.status = 'PENDING'
        ORDER BY di.inbox_id ASC
        LIMIT ?
    ";

    $stmt2 = $conn->prepare($sql);
    $stmt2->bind_param("si", $deviceId, $limit);
    $stmt2->execute();

    $resMsgs = $stmt2->get_result();
    $messages = [];
    while ($row = $resMsgs->fetch_assoc()) {
        $messages[] = $row;
    }

    echo json_encode([
        'success' => true,
        'count' => count($messages),
        'messages' => $messages
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
