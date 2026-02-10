<?php
// api/v4/broadcast/update.php
require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/broadcast_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $bm = new BroadcastManager($pdo);
    $bm->updateList($user['user_id'], $input['list_id'], $input['name']);

    // Handle Member Adds/Removes if needed (Simplified to Name update first, assume other endpoints or logic for members)
    // Manager has updateList only for name. addMembers separate.

    if (isset($input['add_members'])) {
        // Logic to add
        // $bm->addMembers... needs binID
        // Convert hex to bin...
        $bm->addMembers(hex2bin($input['list_id']), $input['add_members']);
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
