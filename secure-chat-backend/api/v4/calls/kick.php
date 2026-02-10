<?php
// api/v4/calls/kick.php
// Epic 77: Kick Participant

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/call_moderation_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$callId = $input['call_id'];
$targetUserId = $input['target_user_id'];
$deviceId = $input['target_device_id'];

try {
    $cmm = new CallModerationManager($pdo);
    $cmm->kickParticipant($user['user_id'], hex2bin($callId), $targetUserId, $deviceId, "Admin Kick");

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
