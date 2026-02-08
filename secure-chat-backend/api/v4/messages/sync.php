<?php
// api/v4/messages/sync.php
// Epic 49: Gap Detection & Repair

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);
    $deviceId = $authData['device_uuid'] ?? '';

    // Hardening: Revoked devices cannot sync
    $stmt = $pdo->prepare("SELECT trust_state FROM devices WHERE device_id = ?");
    $stmt->execute([$deviceId]);
    if ($stmt->fetchColumn() !== 'TRUSTED') {
        http_response_code(403);
        exit;
    }

    $lastSeenId = $_GET['last_message_id'] ?? 0;
    $limit = 100;

    // Fetch missed messages strictly for this device
    // "Repair" means fetching anything > lastSeenId that is still retrievable

    // Note: device_inbox uses inbox_id (auto-inc) as causal ordering for THIS device.
    // We expect last_message_id to correspond to inbox_id from previous pull.

    $stmt = $pdo->prepare("
        SELECT inbox_id, message_uuid, encrypted_payload, nonce, created_at, status
        FROM device_inbox
        WHERE recipient_device_id = ? 
          AND inbox_id > ?
        ORDER BY inbox_id ASC
        LIMIT ?
    ");
    $stmt->execute([$deviceId, $lastSeenId, $limit]);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'count' => count($messages),
        'messages' => $messages
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
