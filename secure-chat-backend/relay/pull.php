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

// 2. Parse Input
$sinceSeq = isset($_GET['since_seq']) ? (int) $_GET['since_seq'] : 0;
// Epic 21: Receipts Cursor
$sinceReceiptId = isset($_GET['since_receipt_id']) ? (int) $_GET['since_receipt_id'] : 0;
$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
$limit = min($limit, 1000); // More generous limit for sync

// 3. Fetch Messages
// Query: Select messages for chats the user is participating in.
// We join chat_participants to valid chats.
$sqlMessages = "
    SELECT m.chat_id, m.server_seq, m.sender_id, m.message_uuid, m.encrypted_payload, m.created_at, m.server_received_at 
    FROM messages m
    JOIN chat_participants cp ON m.chat_id = cp.chat_id
    WHERE cp.user_id = ? AND m.server_seq > ?
    ORDER BY m.server_seq ASC 
    LIMIT ?
";

$stmt = $conn->prepare($sqlMessages);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["error" => "DB_ERROR", "msg" => "Failed to prepare message query"]);
    exit;
}

$stmt->bind_param("sii", $userId, $sinceSeq, $limit);
$stmt->execute();
$resultMessages = $stmt->get_result();

$messages = [];
$maxSeq = $sinceSeq;

while ($row = $resultMessages->fetch_assoc()) {
    $messages[] = [
        "message_uuid" => $row['message_uuid'],
        "chat_id" => $row['chat_id'],
        "sender_id" => $row['sender_id'],
        "server_seq" => (int) $row['server_seq'],
        "encrypted_payload" => $row['encrypted_payload'],
        "created_at" => $row['created_at'],
        "server_received_at" => $row['server_received_at']
    ];
    if ($row['server_seq'] > $maxSeq) {
        $maxSeq = $row['server_seq'];
    }
}
$stmt->close();

// 4. Fetch Receipts (Epic 21)
// Query: Receipts for chats the user is in.
$sqlReceipts = "
    SELECT r.receipt_id, r.chat_id, r.message_uuid, r.user_id, r.device_uuid, r.type, r.created_at
    FROM receipts r
    JOIN chat_participants cp ON r.chat_id = cp.chat_id
    WHERE cp.user_id = ? AND r.receipt_id > ?
    ORDER BY r.receipt_id ASC
    LIMIT ?
";

$stmtR = $conn->prepare($sqlReceipts);
$receipts = [];
$maxReceiptId = $sinceReceiptId;

if ($stmtR) {
    $stmtR->bind_param("sii", $userId, $sinceReceiptId, $limit);
    $stmtR->execute();
    $resultReceipts = $stmtR->get_result();

    while ($row = $resultReceipts->fetch_assoc()) {
        $receipts[] = $row;
        if ($row['receipt_id'] > $maxReceiptId) {
            $maxReceiptId = $row['receipt_id'];
        }
    }
    $stmtR->close();
}

// 5. Response
echo json_encode([
    "messages" => $messages,
    "receipts" => $receipts,
    "last_seq" => $maxSeq,
    "last_receipt_id" => $maxReceiptId,
    "has_more" => (count($messages) >= $limit || count($receipts) >= $limit)
]);

$conn->close();
