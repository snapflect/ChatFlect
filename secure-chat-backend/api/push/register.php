<?php
// api/push/register.php
require_once __DIR__ . '/../../includes/db_connect.php';
require_once __DIR__ . '/../auth_middleware.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate
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
    $token = $input['token'] ?? '';
    $platform = $input['platform'] ?? '';

    // Sanity Checks
    if (empty($token) || strlen($token) < 50) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid token (too short or empty)']);
        exit;
    }

    if (!in_array($platform, ['android', 'ios', 'web'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid platform']);
        exit;
    }

    // 3. Strict Device Check (Revocation)
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
    checkRateLimitPDO($pdo, $user_id, $device_uuid, $clientIp, 'push/register.php', 5, 600);

    // 4. Upsert Token
    // We explicitly set is_active = 1 on new registration
    $stmt = $pdo->prepare("
        INSERT INTO push_tokens (user_id, device_uuid, token, platform, updated_at, is_active, last_error)
        VALUES (?, ?, ?, ?, NOW(), 1, NULL)
        ON DUPLICATE KEY UPDATE
            token = VALUES(token),
            platform = VALUES(platform),
            updated_at = NOW(),
            is_active = 1,
            last_error = NULL
    ");

    $stmt->execute([$user_id, $device_uuid, $token, $platform]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
