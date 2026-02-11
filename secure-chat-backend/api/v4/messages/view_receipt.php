<?php
// api/v4/messages/view_receipt.php
require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/view_once_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['message_id']) || !isset($input['sender_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing fields']);
    exit;
}

try {
    $vom = new ViewOnceManager($pdo);
    // Client sends this when they OPEN the message
    $burned = $vom->markViewed($input['message_id'], $user['user_id'], $input['sender_id']);

    if ($burned) {
        echo json_encode(['success' => true, 'status' => 'burned']);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Message not found']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
