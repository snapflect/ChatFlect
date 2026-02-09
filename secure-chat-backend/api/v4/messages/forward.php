<?php
// api/v4/messages/forward.php
// Epic 78: Secure Forward

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/message_policy_enforcer.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $mpe = new MessagePolicyEnforcer($pdo);

    // Check Policy
    $mpe->canForwardMessage($user['user_id'], $input['source_conversation_id'], $input['target_conversation_id']);

    // Proceed with Forwarding Logic (Message Copy)
    // ...

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
