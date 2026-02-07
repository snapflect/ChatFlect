<?php
/**
 * Relay Pull API
 * Epic 17: Relay Service MVP
 * 
 * Endpoint: GET /relay/pull.php
 * Fetches ordered messages for a chat.
 */

require_once '../api/auth_middleware.php';
require_once '../api/db_connect.php';

// CORS (Standard)
$allowed = ['http://localhost:8100', 'http://localhost:4200', 'capacitor://localhost', 'http://localhost'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}

// 1. Authenticate
require_once '../api/auth_middleware.php';
require_once '../api/db_connect.php';

$authData = requireAuth();
$userId = $authData['user_id'];
$deviceUuid = $authData['device_uuid'] ?? null;

if (empty($deviceUuid)) {
    http_response_code(403);
    echo json_encode(["error" => "MISSING_DEVICE_UUID"]);
    exit;
}

// 1.5 Device Active Check
$stmtDevice = $conn->prepare("SELECT status FROM user_devices WHERE user_id = ? AND device_uuid = ?");
$stmtDevice->bind_param("ss", $userId, $deviceUuid);
$stmtDevice->execute();
$deviceResult = $stmtDevice->get_result();
if ($deviceResult->num_rows === 0 || $deviceResult->fetch_assoc()['status'] !== 'active') {
    http_response_code(403);
    echo json_encode(["error" => "DEVICE_REVOKED", "message" => "Device revoked or not found"]);
    exit;
}
$stmtDevice->close();

// 2. Validate Input
$chatId = $_GET['chat_id'] ?? null;
$sinceSeq = (int) ($_GET['since_seq'] ?? 0);
$limit = (int) ($_GET['limit'] ?? 50);

if (!$chatId) {
    http_response_code(400);
    echo json_encode(["error" => "MISSING_CHAT_ID"]);
    exit;
}

// Cap limit
if ($limit > 200)
    $limit = 200;

// 3. Participant Check
// (Same as send.php - need to verify user is allowed to read this chat)

// 4. Fetch Messages
$stmt = $conn->prepare("SELECT id, message_uuid, sender_id, server_seq, encrypted_payload, created_at, server_received_at FROM messages WHERE chat_id = ? AND server_seq > ? ORDER BY server_seq ASC LIMIT ?");
$stmt->bind_param("sii", $chatId, $sinceSeq, $limit);
$stmt->execute();
$result = $stmt->get_result();

$messages = [];
while ($row = $result->fetch_assoc()) {
    $messages[] = [
        "id" => $row['id'], // SQL ID, internal usage mostly
        "message_uuid" => $row['message_uuid'],
        "sender_id" => $row['sender_id'],
        "server_seq" => (int) $row['server_seq'],
        "encrypted_payload" => $row['encrypted_payload'],
        "created_at" => $row['created_at'],
        "server_received_at" => $row['server_received_at']
    ];
}

$stmt->close();
$conn->close();

echo json_encode([
    "messages" => $messages,
    "count" => count($messages),
    "since_seq" => $sinceSeq
]);
