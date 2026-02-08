<?php
// api/v4/devices/audit.php
// Epic 25: Device Manager - Audit History

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../auth_middleware.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate
    $auth = authenticate_request($pdo);
    $user_id = $auth['user_id'];

    // 2. Parse Parameters
    $limit = isset($_GET['limit']) ? min((int) $_GET['limit'], 100) : 50;
    $device_filter = $_GET['device_uuid'] ?? null;

    // 3. Fetch Audit Logs
    if ($device_filter) {
        $stmt = $pdo->prepare("
            SELECT event_type, device_uuid, ip_address, user_agent, created_at, metadata
            FROM device_audit_logs
            WHERE user_id = ? AND device_uuid = ?
            ORDER BY created_at DESC
            LIMIT ?
        ");
        $stmt->execute([$user_id, $device_filter, $limit]);
    } else {
        $stmt = $pdo->prepare("
            SELECT event_type, device_uuid, ip_address, user_agent, created_at, metadata
            FROM device_audit_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        ");
        $stmt->execute([$user_id, $limit]);
    }

    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Decode metadata JSON
    foreach ($events as &$event) {
        if ($event['metadata']) {
            $event['metadata'] = json_decode($event['metadata'], true);
        }
    }

    echo json_encode([
        'success' => true,
        'events' => $events,
        'count' => count($events)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
