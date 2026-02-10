<?php
// api/v4/broadcast/create.php
require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/broadcast_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $bm = new BroadcastManager($pdo);
    $listId = $bm->createList($user['user_id'], $input['name'], $input['members'] ?? []);
    echo json_encode(['success' => true, 'list_id' => $listId]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
