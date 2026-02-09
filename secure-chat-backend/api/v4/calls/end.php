<?php
// api/v4/calls/end.php
// Epic 76: End Call

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/call_session_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$callId = $input['call_id'];
$reason = $input['reason'] ?? 'HANGUP';

try {
    $csm = new CallSessionManager($pdo);

    $receipt = $csm->endCall($callId, $user['user_id'], $reason);

    echo json_encode(['success' => true, 'receipt' => $receipt]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
