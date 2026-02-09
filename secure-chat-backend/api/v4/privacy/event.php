<?php
// api/v4/privacy/event.php
// Epic 71: Report Screenshot/Recording

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/privacy_event_logger.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $convId = $input['conversation_id'];
    $type = $input['event_type']; // SCREENSHOT_TAKEN, etc
    $platform = $input['platform'];
    $convIdBin = hex2bin($convId);

    $logger = new PrivacyEventLogger($pdo);
    $logger->logEvent($convIdBin, $user['user_id'], $user['device_uuid'] ?? null, $type, $platform);

    // Trigger Alerts if enabled
    $stmt = $pdo->prepare("SELECT alert_on_screenshot FROM conversation_privacy_settings WHERE conversation_id = ?");
    $stmt->execute([$convIdBin]);
    $setting = $stmt->fetchColumn();

    if ($setting !== false && $setting == 1) {
        $logger->broadcastAlert($convIdBin, $user['user_id'], $type);
    }

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
