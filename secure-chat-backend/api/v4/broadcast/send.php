<?php
// api/v4/broadcast/send.php
require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/broadcast_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $bm = new BroadcastManager($pdo);
    // Expects { list_id: "...", payloads: { "user_1": { ciphertext: "..." }, ... } }
    $bm->sendBroadcast($user['user_id'], $input['list_id'], $input['payloads']);
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
