<?php
// api/v4/media/upload.php
// Epic 75: Upload Encrypted Blob

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/attachment_manager.php';
require_once __DIR__ . '/../../includes/attachment_encryptor.php';

$user = authenticate();

// Expect Multipart/Form-Data
// Fields: attachment_id, sha256_hash, mime_type, file (blob)

try {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception("File upload failed");
    }

    $attachmentId = $_POST['attachment_id'];
    $hash = $_POST['sha256_hash'];
    $mime = $_POST['mime_type'];

    // Store Blob
    $encryptor = new AttachmentEncryptor(__DIR__ . '/../../uploads');
    $blobData = file_get_contents($_FILES['file']['tmp_name']);

    // Verify Integrity (Hash of Encrypted Blob)
    if (hash('sha256', $blobData) !== $hash) {
        throw new Exception("Integrity Check Failed: Hash Mismatch");
    }

    $encryptor->storeBlob($attachmentId, $blobData);

    // Create Metadata
    $am = new AttachmentManager($pdo);
    $am->createMetadata($user['user_id'], $attachmentId, strlen($blobData), $mime, $hash);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
