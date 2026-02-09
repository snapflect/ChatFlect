<?php
// api/v4/media/key.php
// Epic 75: Get Wrapped Key

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/attachment_manager.php';

$user = authenticate();
$attachmentId = $_GET['attachment_id'] ?? '';
// Device ID from auth token Context usually, but here checking recipient_device_id
// We assume Authenticated User + Device ID match the key entry.
$deviceId = $user['device_uuid'];

try {
    $am = new AttachmentManager($pdo);

    $wrappedKey = $am->getWrappedKey($attachmentId, $user['user_id'], $deviceId);

    if (!$wrappedKey) {
        http_response_code(404);
        echo json_encode(['error' => 'Key not found for this device']);
        exit;
    }

    echo json_encode(['attachment_id' => $attachmentId, 'wrapped_key' => $wrappedKey]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
