<?php
/**
 * Relay Pull API
 * Epic 17: Relay Service MVP
 * 
 * Endpoint: GET /relay/pull.php
 * Fetches ordered messages for a chat.
 */

require_once '../api/auth_middleware.php';
require_once '../includes/logger.php';
require_once '../includes/metrics.php';
require_once '../api/db_connect.php';

$pullStart = microtime(true);

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
RequestContext::setUser($userId, $deviceUuid);
logInfo('PULL_START', ['since_seq' => $_GET['since_seq'] ?? 0]);

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

// 1.6 Rate Limiting (Epic 23)
require_once '../includes/rate_limiter.php';
$clientIp = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
checkRateLimit($conn, $userId, $deviceUuid, $clientIp, 'relay/pull.php', 120, 60);

// 2. Parse Input (Wait, we need to check DB state for ETag FIRST? No, ETag depends on RESULT usually, OR on server state).
// Efficient ETag: We need to know the 'latest' state without fetching everything.
// Ideal: Client sends 'If-None-Match: "md5_hash_of_last_state"'.
// Server checks current max(server_seq) and max(receipt_id) for this chat/user.

$sinceSeq = isset($_GET['since_seq']) ? (int) $_GET['since_seq'] : 0;
// Epic 21: Receipts Cursor
$sinceReceiptId = isset($_GET['since_receipt_id']) ? (int) $_GET['since_receipt_id'] : 0;
$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
$limit = min($limit, 1000); // More generous limit for sync

// Optimization (Epic 22): ETag Check
// We need cheap query to get max seqs.
// Query: MAX(server_seq) from messages, MAX(receipt_id) from receipts for this user.
// This might be expensive if many rows, BUT with indexes (chat_id, server_seq) and (chat_id, receipt_id) it's instant.
// Actually, we pull for ALL chats user is in. That's harder to ETag globally cheaply without a "UserSyncState" table.
// Fallback: We fetch the data, compute hash, THEN send 304 if matches? 
// That saves bandwidth but not DB load.
// Better: Return 304 if `since_seq == max_seq`? No, new messages might arrive.

// Let's implement the "Active" ETag: Fetch, Compute, Return 304 if matches.
// This is standard for "bandwidth saving".
// To save DB load, we'd need a separate "UserVer" tracking table updated on every message insert.
// For now, we save Bandwidth (Payload KB cost).

// WAIT: The previous plan said: "Hash: md5(chat_id . last_server_seq . last_receipt_id)".
// This implies ETag is per-chat request?
// pull.php seems to filter by User ID (All chats).
// If `pull.php` is global, we need a global state hash.
// Let's stick to "Fetch -> Compute ETag -> Output".
// If client sent If-None-Match and it matches our computed hash, we clear body and send 304.
// But wait, if we already fetched, we paid the DB cost.
// To save DB cost, we need to query ONLY the MAX seqs first.

// Optimized Logic:
// 1. Get MAX(server_seq) and MAX(receipt_id) for User's chats. (Aggregated?)
//   - SELECT MAX(m.server_seq) ... JOIN chat_participants ...
//   - SELECT MAX(r.receipt_id) ...
// 2. Hash = md5($maxSeq . '-' . $maxReceiptId);
// 3. If match -> 304.
// 4. Else -> Fetch full data.

// Let's implement this optimized check.
$sqlCheck = "
    SELECT 
        (SELECT MAX(m.server_seq) FROM messages m JOIN chat_participants cp ON m.chat_id = cp.chat_id WHERE cp.user_id = ?) as max_msg_seq,
        (SELECT MAX(r.receipt_id) FROM receipts r JOIN chat_participants cp ON r.chat_id = cp.chat_id WHERE cp.user_id = ?) as max_receipt_id
";
$stmtC = $conn->prepare($sqlCheck);
$stmtC->bind_param("ss", $userId, $userId);
$stmtC->execute();
$checkRes = $stmtC->get_result()->fetch_assoc();
$globalMaxSeq = $checkRes['max_msg_seq'] ?? 0;
$globalMaxReceipt = $checkRes['max_receipt_id'] ?? 0;
$stmtC->close();

$etag = '"' . md5($userId . '-' . $globalMaxSeq . '-' . $globalMaxReceipt) . '"';

if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    header('HTTP/1.1 304 Not Modified');
    header('ETag: ' . $etag);
    exit;
}
header('ETag: ' . $etag);

// 3. Fetch Messages
// ... (Proceed to fetch)

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
$pullMs = round((microtime(true) - $pullStart) * 1000, 2);
$msgCount = count($messages);
if ($msgCount > 0) {
    logPerf('PULL_SUCCESS', $pullMs, ['message_count' => $msgCount, 'last_seq' => $maxSeq]);
} else {
    logInfo('PULL_EMPTY', ['since_seq' => $sinceSeq]);
}

// Epic 29: Record metrics
recordMetric($pdo, '/relay/pull.php', 'GET', 200, $pullMs);
incrementCounter($pdo, 'relay_pull_total');

echo json_encode([
    "messages" => $messages,
    "receipts" => $receipts,
    "last_seq" => $maxSeq,
    "last_receipt_id" => $maxReceiptId,
    "has_more" => (count($messages) >= $limit || count($receipts) >= $limit),
    "request_id" => getRequestId()
]);

$conn->close();


