<?php
// api/v4/messages/forward.php
// Epic 80 HF: Anti-Forwarding
require_once __DIR__ . '/../../includes/auth_middleware.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$originalMsgId = $input['message_id'];

// Check Original Message
$stmt = $pdo->prepare("SELECT is_view_once FROM messages WHERE message_id = ?");
$stmt->execute([$originalMsgId]);
$meta = $stmt->fetch(PDO::FETCH_ASSOC);

if ($meta && $meta['is_view_once']) {
    http_response_code(403);
    echo json_encode(['error' => 'Cannot forward View Once messages']);
    exit;
}

// ... Proceed with Forwarding Logic (Updates/Inserts) ...
echo json_encode(['success' => true, 'forwarded' => true]);
