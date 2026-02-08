<?php
// relay/fetch_sender_keys.php
// Epic 44: Fetch Sender Keys (Signal Protocol)

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../api/auth_middleware.php';
require_once __DIR__ . '/../includes/group_auth.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);
    $deviceUuid = $authData['device_uuid'] ?? '';

    $groupId = $_GET['group_id'] ?? '';

    if (!$groupId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_GROUP_ID']);
        exit;
    }

    // Verify membership
    requireGroupMember($pdo, $groupId, $userId);

    // Fetch keys encrypted for ME
    $stmt = $pdo->prepare("
        SELECT sender_id, sender_device_uuid, sender_key_id, encrypted_sender_key, created_at
        FROM group_sender_keys
        WHERE group_id = ? AND recipient_id = ? AND recipient_device_uuid = ?
    ");
    $stmt->execute([$groupId, $userId, $deviceUuid]);
    $keys = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'group_id' => $groupId,
        'keys' => $keys,
        'count' => count($keys)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
