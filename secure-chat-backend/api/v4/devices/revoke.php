<?php
// api/v4/devices/revoke.php
// Epic 47: Revoke Device

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/device_manager.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    $input = json_decode(file_get_contents('php://input'), true);
    $targetDeviceId = $input['target_device_id'] ?? '';

    if (!$targetDeviceId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_TARGET_DEVICE']);
        exit;
    }

    $success = revokeDevice($pdo, $userId, $targetDeviceId);

    if ($success) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'DEVICE_NOT_FOUND']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
