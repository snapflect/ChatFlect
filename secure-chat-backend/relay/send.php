<?php
/**
 * Relay Send API
 * Epic 17: Relay Service MVP
 * 
 * Endpoint: POST /relay/send.php
 * Handles message ingestion, sequencing, and storage.
 */

require_once '../api/auth_middleware.php';
require_once '../api/db_connect.php';

// CORS
$allowed = ['http://localhost:8100', 'http://localhost:4200', 'capacitor://localhost', 'http://localhost'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Device-UUID");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. Authenticate
$authData = requireAuth();
$userId = $authData['user_id'];
$deviceUuid = $authData['device_uuid'] ?? null;

if (empty($deviceUuid)) {
    http_response_code(403);
    echo json_encode(["error" => "MISSING_DEVICE_UUID", "message" => "Device UUID is required"]);
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
$input = json_decode(file_get_contents('php://input'), true);

$chatId = $input['chat_id'] ?? null;
$messageUuid = $input['message_uuid'] ?? null;
$encryptedPayload = $input['encrypted_payload'] ?? null;

if (!$chatId || !$messageUuid || !$encryptedPayload) {
    http_response_code(400);
    echo json_encode(["error" => "MISSING_FIELDS", "message" => "chat_id, message_uuid, and encrypted_payload are required"]);
    exit;
}

// UUID Validation
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $messageUuid)) {
    http_response_code(400);
    echo json_encode(["error" => "INVALID_UUID", "message" => "Invalid message_uuid format"]);
    exit;
}

// 3. Participant Check (Security)
// Check if user is participant of chat via Firestore (or SQL if migrated)
// For MVP, we'll assume SQL `chats` table if exists or simple check.
// Using Firestore REST API or similar would be ideal if source of truth is there.
// If Chats are not yet in SQL, we can't do strict check easily without query.
// Allow if `chat_sequences` exists for now, or add TODO.
// PROD Requirement: Verify participation.
// Mock check:
// if (!isParticipant($chatId, $userId)) die(403);


// 4. Idempotency Check (Fast Path)
// Check `messages` table directly for `message_uuid`
$checkStmt = $conn->prepare("SELECT server_seq, created_at FROM messages WHERE message_uuid = ?");
$checkStmt->bind_param("s", $messageUuid);
$checkStmt->execute();
$res = $checkStmt->get_result();
if ($res->num_rows > 0) {
    $row = $res->fetch_assoc();
    echo json_encode([
        "success" => true,
        "duplicate" => true,
        "server_seq" => (int) $row['server_seq'],
        "timestamp" => $row['created_at'] // Already formatted probably
    ]);
    exit;
}
$checkStmt->close();


// 5. Sequencing & Insertion (Atomic Transaction)
$conn->begin_transaction();

try {
    // Lock Sequence Row
    // Ensure row exists first (create if new chat)
    $conn->query("INSERT IGNORE INTO chat_sequences (chat_id, last_seq) VALUES ('$chatId', 0)");

    // Select FOR UPDATE to lock
    $seqStmt = $conn->prepare("SELECT last_seq FROM chat_sequences WHERE chat_id = ? FOR UPDATE");
    $seqStmt->bind_param("s", $chatId);
    $seqStmt->execute();
    $seqRes = $seqStmt->get_result();
    $row = $seqRes->fetch_assoc();
    $nextSeq = $row['last_seq'] + 1;
    $seqStmt->close();

    // Insert Message
    $insertStmt = $conn->prepare("INSERT INTO messages (chat_id, sender_id, server_seq, message_uuid, encrypted_payload) VALUES (?, ?, ?, ?, ?)");
    $insertStmt->bind_param("ssiss", $chatId, $userId, $nextSeq, $messageUuid, $encryptedPayload);
    $insertStmt->execute();
    $insertStmt->close();

    // Update Sequence
    $updateSeq = $conn->prepare("UPDATE chat_sequences SET last_seq = ? WHERE chat_id = ?");
    $updateSeq->bind_param("is", $nextSeq, $chatId);
    $updateSeq->execute();
    $updateSeq->close();

    $conn->commit();

    // Return Success
    echo json_encode([
        "success" => true,
        "server_seq" => $nextSeq,
        "timestamp" => date('Y-m-d H:i:s')
    ]);

} catch (Exception $e) {
    $conn->rollback();
    // Check for duplicate key (race condition managed by lock, but double safety)
    if ($conn->errno === 1062) { // Duplicate entry
        // Retry logic or fail fast?
        // With 'FOR UPDATE' lock, this shouldn't happen for sequence, 
        // but could happen for message_uuid if race between check & insert.
        http_response_code(409); // Conflict
        echo json_encode(["error" => "CONFLICT", "message" => "Duplicate or race condition"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "DB_ERROR", "message" => $e->getMessage()]);
    }
}

$conn->close();
