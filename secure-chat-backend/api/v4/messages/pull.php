<?php
// api/v4/messages/pull.php
// Epic 48: Device-Specific Message Pull

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/rate_limiter.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);
    $deviceId = $authData['device_uuid'] ?? '';

    // Enforce Invariant: Revoked devices cannot pull
    // requireAuth() should handle this, but explicit check acts as defense-in-depth
    $stmt = $pdo->prepare("SELECT trust_state FROM devices WHERE device_id = ?");
    $stmt->execute([$deviceId]);
    $state = $stmt->fetchColumn();

    if ($state !== 'TRUSTED') {
        http_response_code(403);
        echo json_encode(['error' => 'DEVICE_NOT_TRUSTED']);
        exit;
    }

    $limit = 50;

    // Hardening: Explicitly bind query to auth token's device_id
    // Epic 84: Join messages to expose forwarding_score
    $stmt = $pdo->prepare("
        SELECT 
            di.inbox_id, 
            di.message_uuid, 
            di.encrypted_payload, 
            di.nonce, 
            di.created_at,
            m.forwarding_score
        FROM device_inbox di
        LEFT JOIN messages m ON UNHEX(di.message_uuid) = m.message_id
        WHERE di.recipient_device_id = :authDeviceId 
          AND di.status = 'PENDING'
        ORDER BY di.inbox_id ASC
        LIMIT :limit
    ");

    $stmt->bindValue(':authDeviceId', $deviceId);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'count' => count($messages),
        'messages' => $messages
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
