<?php
// api/v4/calls/force_end.php
// Epic 77: Admin Force End

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/call_moderation_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$callId = $input['call_id'];
$reason = $input['reason'] ?? 'Admin Action';

try {
    $cmm = new CallModerationManager($pdo);
    $cmm->forceEndCall($user['user_id'], hex2bin($callId), $reason);

    echo json_encode(['success' => true, 'status' => 'ENDED']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
