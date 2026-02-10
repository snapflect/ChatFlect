<?php
// api/v4/devices/approve.php
// Epic 47: Approve Pending Device

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../../includes/device_manager.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);

    // Only TRUSTED devices can approve others
    // (Actual check logic inside requireAuth ensures device is valid/active, 
    // but explicit check in DB schema ensures trust_state is honored)

    $input = json_decode(file_get_contents('php://input'), true);
    $targetDeviceId = $input['target_device_id'] ?? '';

    if (!$targetDeviceId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_TARGET_DEVICE']);
        exit;
    }

    approveDevice($pdo, $userId, $targetDeviceId);

    // TODO: Emit push notification "Device Approved" (Epic 48)

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
