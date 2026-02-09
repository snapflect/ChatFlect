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

    // HF-76.2: Listen for Resync
    if (isset($input['resync_epoch'])) {
        $result = $cre->resyncEpoch($callId, $user['user_id'], $user['device_uuid'], (int) $input['resync_epoch']);
        // Fetch fresh states
        // If resync, the 'new_epoch' in the response should reflect the current epoch after resync.
        // Assuming resyncEpoch returns the current epoch or it can be fetched.
        // For now, we'll set it to null or fetch it from states if needed.
        $newEpoch = null; // Or fetch from $result if resyncEpoch returns it
    } else {
        // Rotate MY key
        $newEpoch = $cre->rotateKey($callId, $user['user_id'], $user['device_uuid']);
    }

    // Get ALL participants state (so I know their epochs)
    $states = $cre->getRatchetStates($callId);

    // If $newEpoch was null due to resync, try to get the current user's epoch from the states
    if ($newEpoch === null) {
        foreach ($states as $state) {
            if ($state['user_id'] == $user['user_id'] && $state['device_uuid'] == $user['device_uuid']) {
                $newEpoch = $state['epoch'];
                break;
            }
        }
    }

    echo json_encode(['success' => true, 'new_epoch' => $newEpoch, 'participants' => $states]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
