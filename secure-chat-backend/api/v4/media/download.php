<?php
// api/v4/media/download.php
// Epic 75: Download Encrypted Blob

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/attachment_manager.php';
require_once __DIR__ . '/../../includes/attachment_encryptor.php';

$user = authenticate();
$attachmentId = $_GET['attachment_id'] ?? '';

try {
    $am = new AttachmentManager($pdo);

    // Verify Access
    if (!$am->verifyAccess($attachmentId, $user['user_id'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Access Denied']);
        exit;
    }

    $encryptor = new AttachmentEncryptor(__DIR__ . '/../../uploads');
    $filePath = $encryptor->getBlobPath($attachmentId);

    // Serve File
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $attachmentId . '.bin"');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);

} catch (Exception $e) {
    http_response_code(404);
    echo json_encode(['error' => $e->getMessage()]);
}
