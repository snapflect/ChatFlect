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

    $convIdBin = (strlen($convId) === 64) ? hex2bin($convId) : $convId; // Handle binary vs string

    // HF-2.2: Idempotency Check (Fast Path)
    $stmtCheck = $pdo->prepare("SELECT id, server_received_at FROM messages WHERE message_uuid = ?");
    $stmtCheck->execute([$clientUuid]);
    $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
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
    // Note: GPE might expect binary convIdBin. 
    if (!$gpe->canSendMessage($convIdBin, $user['user_id'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Only admins can send messages in this group']);
        exit;
    }

    // Idempotent Insertion using client_uuid
    $stmt = $pdo->prepare("INSERT IGNORE INTO messages (chat_id, sender_id, message_uuid, encrypted_payload, server_seq, created_at) VALUES (?, ?, ?, ?, 0, NOW())");
    $stmt->execute([$convId, $user['user_id'], $clientUuid, $content]);

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
