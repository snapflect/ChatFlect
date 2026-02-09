<?php
// api/v4/calls/ratchet.php
// Epic 76: Ratchet Key Rotation

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/call_ratchet_engine.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$callId = $input['call_id'];

try {
    $cre = new CallRatchetEngine($pdo);

    // Rotate MY key
    $newEpoch = $cre->rotateKey($callId, $user['user_id'], $user['device_uuid']);

    // Get ALL participants state (so I know their epochs)
    $states = $cre->getRatchetStates($callId);

    echo json_encode(['success' => true, 'new_epoch' => $newEpoch, 'participants' => $states]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
