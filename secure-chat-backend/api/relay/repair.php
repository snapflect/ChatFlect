<?php
// api/relay/repair.php
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

    // 2. Validate Input
    $chat_id = $_GET['chat_id'] ?? null;
    $start_seq = isset($_GET['start_seq']) ? (int) $_GET['start_seq'] : 0;
    $end_seq = isset($_GET['end_seq']) ? (int) $_GET['end_seq'] : 0;

    if (!$chat_id || $start_seq <= 0 || $end_seq <= 0 || $end_seq < $start_seq) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid range parameters']);
        exit;
    }

    // Cap range request (Max 500)
    $count = $end_seq - $start_seq + 1;
    if ($count > 500) {
        http_response_code(400);
        echo json_encode(['error' => 'Range too large (max 500)']);
        exit;
    }

    // 3. Fetch Missing Messages
    // Join chat_participants to verify access
    $sql = "
        SELECT m.server_seq, m.sender_id, m.message_uuid, m.encrypted_payload, m.created_at, m.server_received_at 
        FROM messages m
        JOIN chat_participants cp ON m.chat_id = cp.chat_id
        WHERE cp.user_id = ? 
        AND m.chat_id = ?
        AND m.server_seq BETWEEN ? AND ?
        ORDER BY m.server_seq ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$user_id, $chat_id, $start_seq, $end_seq]);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Response
    echo json_encode([
        "messages" => $messages,
        "count" => count($messages),
        "range_start" => $start_seq,
        "range_end" => $end_seq
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
