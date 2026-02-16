<?php
// api/v4/conversations/privacy_settings.php
// Epic 71: Configure Screen Shield

require_once __DIR__ . '/../../../api/auth_middleware.php';
require_once __DIR__ . '/../../includes/ops_manager.php';
require_once __DIR__ . '/../../includes/privacy_policy_enforcer.php';

$authData = requireAuth();
$userId = $authData['user_id'];
$input = json_decode(file_get_contents('php://input'), true);
$convId = $input['conversation_id'];
$shield = (bool) $input['shield_mode'];
$alert = (bool) ($input['alert_on_screenshot'] ?? true);

try {
    $convIdBin = hex2bin($convId);

    // Check Admin rights
    // assumed verifyConversationAdmin($user, $convIdBin);

    $enforcer = new PrivacyPolicyEnforcer($pdo);
    $enforcer->enforce($convIdBin, $shield);

    $sql = "INSERT INTO conversation_privacy_settings (conversation_id, shield_mode, alert_on_screenshot, updated_by)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE shield_mode=VALUES(shield_mode), 
                                    alert_on_screenshot=VALUES(alert_on_screenshot),
                                    updated_by=VALUES(updated_by)";
    $pdo->prepare($sql)->execute([$convIdBin, $shield, $alert, $user['user_id']]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
