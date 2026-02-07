<?php
// api/relay/receipt.php
require_once __DIR__ . '/../../includes/db_connect.php';
require_once __DIR__ . '/../auth_middleware.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate
    $auth = authenticate_request($pdo);
    $user_id = $auth['user_id'];
    $device_uuid = $auth['device_uuid'] ?? null;

    if (!$device_uuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Device UUID required']);
        exit;
    }

    // 2. Validate Device (Revocation Check)
    $stmt = $pdo->prepare("SELECT status FROM devices WHERE device_uuid = ? AND user_id = ?");
    $stmt->execute([$device_uuid, $user_id]);
    $device = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$device || $device['status'] !== 'active') {
        http_response_code(403);
        echo json_encode(['error' => 'Device revoked or invalid']);
        exit;
    }

    // 3. Parse Input
    $input = json_decode(file_get_contents('php://input'), true);
    $chat_id = $input['chat_id'] ?? '';
    $message_uuid = $input['message_uuid'] ?? '';
    $type = $input['type'] ?? '';

    // 4. Validate Fields
    if (empty($chat_id) || empty($message_uuid) || empty($type)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing fields']);
        exit;
    }

    if (!in_array($type, ['DELIVERED', 'READ'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid type']);
        exit;
    }

    // Validate UUIDv7 Format (Approximate regex)
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $message_uuid)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid message_uuid format']);
        exit;
    }

    // 5. Store Receipt (Idempotent)
    // We store device_uuid for audit
    $stmt = $pdo->prepare("
        INSERT IGNORE INTO receipts (chat_id, message_uuid, user_id, device_uuid, type, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ");

    $stmt->execute([$chat_id, $message_uuid, $user_id, $device_uuid, $type]);

    // Check if inserted
    $inserted = $stmt->rowCount() > 0;

    // 6. Push Notification for Receipt? 
    // Usually receipts don't trigger push unless it's a Call?
    // For now, silent sync via Pull.

    echo json_encode([
        'success' => true,
        'newly_created' => $inserted
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
