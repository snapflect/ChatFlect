<?php
// api/v4/privacy/anonymous_mode.php
// Epic 74: Enable/Disable Anonymous Mode

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/anonymous_profile_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

$convId = $input['conversation_id'];
$enabled = $input['enabled'] ?? true;
$aliasName = $input['alias_name'] ?? 'Anonymous';

try {
    $apm = new AnonymousProfileManager($pdo);

    if ($enabled) {
        $apm->enableAnonymousMode($user['user_id'], $convId, $aliasName);
        echo json_encode(['success' => true, 'mode' => 'ANONYMOUS', 'alias' => $aliasName]);
    } else {
        $apm->disableAnonymousMode($user['user_id'], $convId);
        echo json_encode(['success' => true, 'mode' => 'REAL_IDENTITY']);
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
