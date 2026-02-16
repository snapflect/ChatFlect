<?php
// relay/upload_sender_key.php
// Epic 44: Upload Sender Key (Signal Protocol)

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../api/auth_middleware.php';
require_once __DIR__ . '/../includes/group_auth.php';
require_once __DIR__ . '/../includes/rate_limiter.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $userId = strtoupper($authData['user_id']);
    $deviceUuid = $authData['device_uuid'] ?? '';

    // Rate limit: 50 per minute (keys need frequent rotation)
    checkRateLimit($pdo, $userId, 'key_upload', 50, 60);

    $input = json_decode(file_get_contents('php://input'), true);

    $groupId = $input['group_id'] ?? '';
    $bundleVersion = (int) ($input['bundle_version'] ?? 0); // HF-5B.2
    $senderKeyId = (int) ($input['sender_key_id'] ?? 0);
    $recipientKeys = $input['recipient_keys'] ?? []; // Array of {recipient_id, device_uuid, encrypted_key}

    if (!$groupId || !$senderKeyId || empty($recipientKeys)) {
        http_response_code(400);
        echo json_encode(['error' => 'INVALID_PARAMS']);
        exit;
    }

    // Verify membership
    requireGroupMember($pdo, $groupId, $userId);

    // HF-5B.2: Replay Protection Check
    $stmtCheck = $pdo->prepare("SELECT bundle_version FROM group_sender_key_state WHERE group_id = ? AND sender_id = ? AND sender_device_uuid = ?");
    $stmtCheck->execute([$groupId, $userId, $deviceUuid]);
    $currentVersion = $stmtCheck->fetchColumn();

    if ($currentVersion !== false && $bundleVersion <= $currentVersion) {
        http_response_code(409);
        echo json_encode(['error' => 'OLD_KEY_VERSION', 'current' => $currentVersion, 'received' => $bundleVersion]);
        exit;
    }

    $pdo->beginTransaction();

    // 1. Update Sender Key State
    $stmt = $pdo->prepare("
        INSERT INTO group_sender_key_state (group_id, sender_id, sender_device_uuid, sender_key_id, bundle_version, last_rotated_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE sender_key_id = VALUES(sender_key_id), bundle_version = VALUES(bundle_version), last_rotated_at = NOW()
    ");
    $stmt->execute([$groupId, $userId, $deviceUuid, $senderKeyId, $bundleVersion]);

    // 2. Store Encrypted Keys for Recipients
    $stmtInsert = $pdo->prepare("
        INSERT INTO group_sender_keys 
        (group_id, sender_id, sender_device_uuid, recipient_id, recipient_device_uuid, sender_key_id, encrypted_sender_key, bundle_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            sender_key_id = VALUES(sender_key_id),
            encrypted_sender_key = VALUES(encrypted_sender_key),
            bundle_version = VALUES(bundle_version),
            created_at = NOW()
    ");

    foreach ($recipientKeys as $rk) {
        $rId = strtoupper($rk['recipient_id'] ?? '');
        $rDevice = $rk['device_uuid'] ?? '';
        $encKey = $rk['encrypted_key'] ?? '';

        if ($rId && $rDevice && $encKey) {
            $stmtInsert->execute([
                $groupId,
                $userId,
                $deviceUuid,
                $rId,
                $rDevice,
                $senderKeyId,
                $encKey,
                $bundleVersion
            ]);
        }
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'count' => count($recipientKeys)
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
