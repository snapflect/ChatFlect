<?php
// api/v4/backup/download.php
// Epic 73: Download Encrypted Blob

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/restore_manager.php';

$user = authenticate();
$jobId = $_GET['job_id'];

try {
    $rm = new RestoreManager($pdo);
    $blob = $rm->getBackupBlob($jobId, $user['user_id']);

    if (!$blob) {
        http_response_code(404);
        echo json_encode(['error' => 'Blob not found']);
        exit;
    }

    // Return formatted blob with Metadata required for decryption (IV/AuthTag)
    echo json_encode([
        'encrypted_data' => base64_encode($blob['encrypted_data']),
        'iv' => base64_encode($blob['iv']),
        'auth_tag' => base64_encode($blob['auth_tag'])
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
