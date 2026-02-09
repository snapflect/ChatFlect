<?php
// api/v4/privacy/alias.php
// Epic 74: Update Alias

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/anonymous_profile_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

$convId = $input['conversation_id'];
$aliasName = $input['alias_name'];

try {
    $apm = new AnonymousProfileManager($pdo);

    // We strictly use enable logic to update alias, keeping is_anonymous state?
    // enableAnonymousMode sets is_anonymous=TRUE.
    // If user just wants to change alias but stay in current mode?
    // Assuming changing alias implies wanting to use it.

    $apm->enableAnonymousMode($user['user_id'], $convId, $aliasName);

    echo json_encode(['success' => true, 'alias' => $aliasName]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
