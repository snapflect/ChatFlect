<?php
// api/v4/media/token.php
// HF-75.4: Generate Signed Download Token

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/attachment_manager.php';

$user = authenticate();
$attachmentId = $_GET['attachment_id'] ?? '';

try {
    $am = new AttachmentManager($pdo);

    // Check Access
    if (!$am->verifyAccess($attachmentId, $user['user_id'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Access Denied']);
        exit;
    }

    $token = $am->generateDownloadToken($attachmentId, $user['user_id']);

    // Log Key Fetch / Token Gen might be considered intent to access
    $am->logEvent($user['user_id'], $attachmentId, 'KEY_FETCH', ['note' => 'Generated Token']);

    echo json_encode(['token' => $token, 'expires_in' => 60]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
