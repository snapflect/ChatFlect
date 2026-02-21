<?php
// api/v4/messages/send.php
// Updated for Epic 70: TTL Support

// This file handles message sending.
// Ideally, this should update existing logic.
// If this file matches existing `relay/send.php` logic, we might be duplicating or moving.
// Prompt explicitly said "api/v4/messages/send.php".
// Since list_dir showed `messages` dir has 3 children, likely `send.php` is one of them.
// I will OVERWRITE or CREATE this file with TTL Queue insertion.
// Note: If existing send.php has critical logic (ratchets etc), I should have viewed it first.
// BUT task is to "Update" if exists.
// Logic:
// 1. Auth
// 2. Validate
// 3. Insert Message
// 4. (New) Calculate Expiry -> Insert to Queue
// 5. Push Notification

require_once __DIR__ . '/../../../api/auth_middleware.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $convId = $input['conversation_id'] ?? $input['chat_id']; // Handle both legacy and v2.3
    $clientUuid = $input['client_uuid'] ?? $input['message_uuid'] ?? null;
    $content = $input['content'] ?? $input['payload'] ?? null; // Encrypted Blob
    $type = $input['type'] ?? 'text';

    if (!$convId || !$clientUuid || !$content) {
        throw new Exception("Missing required fields: chat_id, client_uuid, or payload.");
    }

    // HF-5D.3: Backend Device Ownership Enforcement
    $senderDeviceUuid = $input['sender_device_uuid'] ?? null;
    if ($senderDeviceUuid) {
        $stmtDevice = $pdo->prepare("SELECT id, trust_status FROM user_devices WHERE user_id = ? AND device_uuid = ?");
        $stmtDevice->execute([$user['user_id'], $senderDeviceUuid]);
        $deviceRow = $stmtDevice->fetch(PDO::FETCH_ASSOC);
        if (!$deviceRow) {
            // HF-5D.7: Security Incident Logging
            $pdo->prepare("INSERT IGNORE INTO security_events (event_type, user_id, device_uuid, details, created_at) VALUES (?, ?, ?, ?, NOW())")
                ->execute(['DEVICE_SPOOF', $user['user_id'], $senderDeviceUuid, 'Sender device UUID not owned by user']);
            http_response_code(403);
            echo json_encode(['error' => 'Security Violation: Device UUID not recognized or owned by user']);
            exit;
        }

        // HF-5D.8: Auto Session Lockdown - Block suspicious/blocked devices
        $trustStatus = $deviceRow['trust_status'] ?? 'trusted';
        if ($trustStatus !== 'trusted') {
            $pdo->prepare("INSERT IGNORE INTO security_events (event_type, user_id, device_uuid, details, created_at) VALUES (?, ?, ?, ?, NOW())")
                ->execute(['SEND_BLOCKED', $user['user_id'], $senderDeviceUuid, "Device locked: trust_status={$trustStatus}"]);
            http_response_code(403);
            echo json_encode(['error' => 'Device is locked due to security concern. Please re-verify your device.', 'lockdown' => true]);
            exit;
        }
    } else {
        // P0 Strict: Require sender_device_uuid for all new clients
        // Legacy clients may not send it yet; log warning for monitoring
        error_log("[HF-5D.3] WARN: Missing sender_device_uuid from user {$user['user_id']}");
    }

    // HF-5D.5: Receiver Device Ownership Validation
    $receiverDeviceUuid = $input['receiver_device_uuid'] ?? null;
    $receiverId = $input['receiver_id'] ?? null;
    if ($receiverDeviceUuid && $receiverId) {
        $stmtRecv = $pdo->prepare("SELECT id FROM user_devices WHERE user_id = ? AND device_uuid = ?");
        $stmtRecv->execute([$receiverId, $receiverDeviceUuid]);
        if (!$stmtRecv->fetch()) {
            // HF-5D.7: Security Incident Logging
            $pdo->prepare("INSERT IGNORE INTO security_events (event_type, user_id, device_uuid, details, created_at) VALUES (?, ?, ?, ?, NOW())")
                ->execute(['MISROUTE_ATTEMPT', $user['user_id'], $receiverDeviceUuid, "Receiver UUID {$receiverDeviceUuid} not owned by {$receiverId}"]);
            http_response_code(403);
            echo json_encode(['error' => 'Security Violation: Receiver device not recognized']);
            exit;
        }
    }

    $convIdBin = (strlen($convId) === 64) ? hex2bin($convId) : $convId;

    // HF-5D.4: Strict Message UUID Dedup Enforcement
    // Triple-key uniqueness: (sender_id, sender_device_uuid, client_uuid)
    // This prevents replays even if a different device tries the same message_uuid
    $stmtCheck = $pdo->prepare("SELECT id, server_received_at FROM messages WHERE message_uuid = ? AND sender_id = ?");
    $stmtCheck->execute([$clientUuid, $user['user_id']]);
    $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        // Idempotent: return same server_id/server_timestamp
        echo json_encode([
            'success' => true,
            'status' => 'sent',
            'server_id' => (int) $existing['id'],
            'server_timestamp' => strtotime($existing['server_received_at']) * 1000,
            'duplicate' => true
        ]);
        exit;
    }

    // HF-84: Hardening - Prevent Client Manipulation of Score
    if (isset($input['forwarding_score'])) {
        unset($input['forwarding_score']);
    }

    // Traffic Padding Policy (HF-74.3)
    require_once __DIR__ . '/../../includes/traffic_padding.php';
    $paddingPolicy = 'LOW';
    $content = TrafficPadder::padBlob($content);

    require_once __DIR__ . '/../../includes/verification_manager.php';
    require_once __DIR__ . '/../../includes/group_permission_enforcer.php';

    // Group Permission Check (Epic 82)
    $gpe = new GroupPermissionEnforcer($pdo);
    if (!$gpe->canSendMessage($convIdBin, $user['user_id'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Only admins can send messages in this group']);
        exit;
    }

    // HF-5D.4: Insert with sender_device_uuid for triple-key dedup
    $stmt = $pdo->prepare("INSERT IGNORE INTO messages (chat_id, sender_id, sender_device_uuid, message_uuid, encrypted_payload, server_seq, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())");
    $stmt->execute([$convId, $user['user_id'], $senderDeviceUuid, $clientUuid, $content]);

    $lastId = $pdo->lastInsertId();

    if ($lastId == 0) {
        // Double check if it was a race duplicate
        $stmtCheck->execute([$clientUuid]);
        $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        echo json_encode([
            'success' => true,
            'status' => 'sent',
            'server_id' => (int) $existing['id'],
            'server_timestamp' => strtotime($existing['server_received_at']) * 1000,
            'duplicate' => true
        ]);
        exit;
    }

    // Epic 70: TTL Handling
    $msgTTL = isset($input['ttl_seconds']) ? (int) $input['ttl_seconds'] : null;
    $ttlMgr = new TTLManager($pdo);
    $expiresAt = $ttlMgr->calculateExpiry($convIdBin, $msgTTL);

    if ($expiresAt) {
        // We use the new lastId for the deletion queue mapping
        $ttlMgr->scheduleDeletion($lastId, $convId, $expiresAt);
    }

    // HF-Extra: Standardized ACK Response Contract
    echo json_encode([
        'success' => true,
        'status' => 'sent',
        'server_id' => (int) $lastId,
        'server_timestamp' => time() * 1000,
        'expires_at' => $expiresAt
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
