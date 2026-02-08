<?php
// api/v4/devices/revoke.php
// Epic 25: Device Manager - Revoke Device

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../auth_middleware.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate
    $auth = authenticate_request($pdo);
    $user_id = $auth['user_id'];
    $current_device = $auth['device_uuid'] ?? null;

    // 2. Parse Input
    $input = json_decode(file_get_contents('php://input'), true);
    $target_device = $input['device_uuid'] ?? null;
    $force_logout = $input['force_logout'] ?? false;

    if (!$target_device) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_DEVICE_UUID']);
        exit;
    }

    // 3. Verify device belongs to user
    $stmt = $pdo->prepare("SELECT status FROM devices WHERE device_uuid = ? AND user_id = ?");
    $stmt->execute([$target_device, $user_id]);
    $device = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$device) {
        http_response_code(403);
        echo json_encode(['error' => 'DEVICE_NOT_OWNED']);
        exit;
    }

    // 4. Prevent revoking current device unless force_logout
    if ($target_device === $current_device && !$force_logout) {
        http_response_code(400);
        echo json_encode(['error' => 'CANNOT_REVOKE_CURRENT', 'message' => 'Set force_logout=true to revoke current device']);
        exit;
    }

    // 5. Revoke Device
    $stmt = $pdo->prepare("UPDATE devices SET status = 'revoked', revoked_at = NOW() WHERE device_uuid = ? AND user_id = ?");
    $stmt->execute([$target_device, $user_id]);

    // 6. Clear presence
    $pdo->prepare("DELETE FROM presence WHERE device_uuid = ? AND user_id = ?")->execute([$target_device, $user_id]);

    // 7. Log Audit Event
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
    $stmt = $pdo->prepare("
        INSERT INTO device_audit_logs (user_id, device_uuid, event_type, ip_address, user_agent, metadata)
        VALUES (?, ?, 'REVOKE', ?, ?, ?)
    ");
    $stmt->execute([$user_id, $target_device, $ip, $ua, json_encode(['revoked_by' => $current_device])]);

    echo json_encode([
        'success' => true,
        'device_uuid' => $target_device,
        'status' => 'revoked'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
