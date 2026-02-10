<?php
// api/presence/update.php
require_once __DIR__ . '/../../includes/db_connect.php';
require_once __DIR__ . '/../auth_middleware.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate User & Device
    $auth = authenticate_request($pdo);
    $user_id = $auth['user_id'];
    $device_uuid = $auth['device_uuid'] ?? null;

    if (!$device_uuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Device UUID required']);
        exit;
    }

    // 2. Validate Input
    $input = json_decode(file_get_contents('php://input'), true);
    $status = $input['status'] ?? null; // 'online', 'offline'
    $typing_in = $input['typing_in'] ?? null; // chat_id or null

    if (!in_array($status, ['online', 'offline', 'busy'])) {
        // If just typing update, status might not be sent? 
        // Plan says status is passed. Default to 'online' if omitted?
        // Let's enforce status presence for heartbeat.
        if (!$status) {
            http_response_code(400);
            echo json_encode(['error' => 'Status required']);
            exit;
        }
        // Validate enum
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status']);
        exit;
    }

    // 3. Strict Device Check (Revocation)
    // Auth middleware usually checks valid device, but we double check status='active'
    $stmt = $pdo->prepare("SELECT status FROM devices WHERE device_uuid = ? AND user_id = ?");
    $stmt->execute([$device_uuid, $user_id]);
    $device = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$device || $device['status'] !== 'active') {
        http_response_code(403);
        echo json_encode(['error' => 'Device revoked or invalid']);
        exit;
    }

    // 3.5 Rate Limiting (Epic 23)
    require_once __DIR__ . '/../../includes/rate_limiter.php';
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    checkRateLimitPDO($pdo, $user_id, $device_uuid, $clientIp, 'presence/update.php', 6, 60);

    // 4. Rate Guard (10s Throttling)
    // Only fetch necessary column to optimize
    $stmt = $pdo->prepare("SELECT last_seen, typing_in_chat FROM presence WHERE user_id = ? AND device_uuid = ?");
    $stmt->execute([$user_id, $device_uuid]);
    $current = $stmt->fetch(PDO::FETCH_ASSOC);

    $now = time();
    $should_update = true;

    if ($current) {
        $last_seen_ts = strtotime($current['last_seen']);
        $diff = $now - $last_seen_ts;

        // Logic: Allow update IF > 10s passed OR typing state changed
        $params_typing = $typing_in === '' ? null : $typing_in; // Normalize empty string to null if needed
        $current_typing = $current['typing_in_chat'];

        if ($diff < 10 && $params_typing === $current_typing && $status === 'online') {
            // Rate limited - return success to client but Skip DB write
            // Note: If status changed (online->offline), we generally allow it immediately?
            // Let's assume offline transition is critical and allow it.
            // If status is same ('online') and typing same, then throttled.
            $should_update = false;
        }
    }

    if ($should_update) {
        $stmt = $pdo->prepare("
            INSERT INTO presence (user_id, device_uuid, status, last_seen, typing_in_chat, app_version)
            VALUES (?, ?, ?, NOW(), ?, ?)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                last_seen = NOW(),
                typing_in_chat = VALUES(typing_in_chat),
                app_version = VALUES(app_version)
        ");

        $app_version = $_SERVER['HTTP_X_APP_VERSION'] ?? null;

        $stmt->execute([
            $user_id,
            $device_uuid,
            $status,
            $typing_in,
            $app_version
        ]);
    }

    echo json_encode(['success' => true, 'updated' => $should_update]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error', 'message' => $e->getMessage()]);
}
