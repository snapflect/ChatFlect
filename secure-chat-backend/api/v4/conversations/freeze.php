<?php
// api/v4/conversations/freeze.php
// Epic 78: Freeze Chat

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/conversation_moderation_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $cmm = new ConversationModerationManager($pdo);
    $cmm->freezeConversation($user['user_id'], $input['conversation_id'], $input['reason'] ?? 'Admin Action');

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
