<?php
// api/v4/calls/create.php
// Epic 76: Start Call

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/call_session_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $csm = new CallSessionManager($pdo);

    // Generate Random Call ID
    $callId = bin2hex(random_bytes(32));

    $csm->createCall($user['user_id'], $callId);

    // Auto-Join Creator
    $csm->joinCall($callId, $user['user_id'], $user['device_uuid']);

    echo json_encode(['success' => true, 'call_id' => $callId]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
