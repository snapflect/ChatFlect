<?php
// api/v4/calls/join.php
// Epic 76: Join Call

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/call_session_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$callId = $input['call_id'];

try {
    $csm = new CallSessionManager($pdo);

    $csm->joinCall($callId, $user['user_id'], $user['device_uuid']);

    echo json_encode(['success' => true, 'status' => 'JOINED']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
