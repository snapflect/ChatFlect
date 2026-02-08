<?php
// api/v4/devices/list.php
// Epic 25: Device Manager - List Devices

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../auth_middleware.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate
    $auth = authenticate_request($pdo);
    $user_id = $auth['user_id'];
    $current_device = $auth['device_uuid'] ?? null;

    // 2. Fetch all devices for user
    $stmt = $pdo->prepare("
        SELECT 
            d.device_uuid,
            d.device_name,
            d.platform,
            d.status,
            d.registered_at,
            p.last_seen,
            p.app_version
        FROM devices d
        LEFT JOIN presence p ON d.device_uuid = p.device_uuid AND d.user_id = p.user_id
        WHERE d.user_id = ?
        ORDER BY d.registered_at DESC
    ");
    $stmt->execute([$user_id]);
    $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Mark current device
    foreach ($devices as &$device) {
        $device['is_current'] = ($device['device_uuid'] === $current_device);
    }

    echo json_encode([
        'success' => true,
        'devices' => $devices,
        'count' => count($devices)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
