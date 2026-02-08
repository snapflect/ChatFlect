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

    // Fetch from device_inbox
    $stmt = $pdo->prepare("
        SELECT inbox_id, message_uuid, encrypted_payload, nonce, created_at 
        FROM device_inbox 
        WHERE recipient_device_id = ? AND status = 'PENDING'
        ORDER BY inbox_id ASC
        LIMIT ?
    ");
    $stmt->execute([$deviceId, $limit]);
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
