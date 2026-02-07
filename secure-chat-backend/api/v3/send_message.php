<?php
// api/v3/send_message.php
// GOAL: Backend Gatekeeper for Message Sending (Replay Protection & Anti-Tamper)

require_once '../auth_middleware.php';
require_once '../db_connect.php'; // v3 path
require_once '../google_auth.php'; // Helper for Service Account Token

// Allow CORS
$allowed = ['http://localhost:8100', 'http://localhost:4200', 'capacitor://localhost', 'http://localhost'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Signal-Metadata-Signature");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. Authenticate User (Enforces Device Binding)
$authData = requireAuth();
$userId = $authData['user_id'];
$deviceUuid = $authData['device_uuid'] ?? 'unknown';

// 2. Parse Input (STRICT FIX: Read php://input ONCE)
$rawBody = file_get_contents("php://input");
$input = json_decode($rawBody, true);

if (!$input || !isset($input['id'])) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid payload"]);
    exit;
}

$msgId = $input['id'];
$chatId = $_GET['chat_id'] ?? $input['chatId'] ?? null; // Can come from URL or Body
$timestamp = $input['timestamp'] ?? 0;

if (!$chatId) {
    http_response_code(400);
    echo json_encode(["error" => "Chat ID required"]);
    exit;
}

// 3. MESSAGE UUID VALIDATION (Epic 12: Idempotency)
// Client MUST provide a valid UUIDv7
$messageUuid = $input['message_uuid'] ?? null;

if (!$messageUuid) {
    http_response_code(400);
    echo json_encode(["error" => "MISSING_MESSAGE_UUID", "message" => "Client must provide message_uuid"]);
    exit;
}

// Validate UUIDv7 format: version 7, variant 10
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $messageUuid)) {
    http_response_code(400);
    echo json_encode(["error" => "INVALID_UUID_FORMAT", "message" => "message_uuid must be UUIDv7"]);
    exit;
}

// 3.1 IDEMPOTENCY CHECK - Return existing message if duplicate
$stmtIdem = $conn->prepare("SELECT message_uuid, created_at FROM message_idempotency WHERE message_uuid = ?");
$stmtIdem->bind_param("s", $messageUuid);
$stmtIdem->execute();
$resIdem = $stmtIdem->get_result();

if ($resIdem->num_rows > 0) {
    // Duplicate detected - return success with existing data (idempotent)
    $existingRow = $resIdem->fetch_assoc();
    $stmtIdem->close();

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "id" => $msgId,
        "message_uuid" => $messageUuid,
        "duplicate" => true,
        "original_created_at" => $existingRow['created_at']
    ]);
    exit;
}
$stmtIdem->close();

// 4. TIMESTAMP VALIDATION (Anti-Tamper / Skew Check)
$serverTime = round(microtime(true) * 1000);
$skewLimit = 5 * 60 * 1000; // 5 Minutes
if (abs($serverTime - $timestamp) > $skewLimit) {
    http_response_code(400);
    echo json_encode(["error" => "Clock skew too large", "server_time" => $serverTime]);
    exit;
}

// 3.5 SIGNATURE VERIFICATION (STRICT FIX: ECDSA P-256)
$headers = getallheaders();
$clientSig = $headers['X-Signal-Metadata-Signature'] ?? $headers['x-signal-metadata-signature'] ?? '';

if (empty($clientSig)) {
    http_response_code(401);
    echo json_encode(["error" => "Missing Integrity Signature"]);
    exit;
}

// Fetch Device Signing Key
// STRICT: Only use signing_public_key (ECDSA). Do not fall back to Signal Key.
$stmtKey = $conn->prepare("SELECT signing_public_key FROM user_devices WHERE user_id = ? AND device_uuid = ? AND status = 'active'");
$stmtKey->bind_param("ss", $userId, $deviceUuid);
$stmtKey->execute();
$resKey = $stmtKey->get_result();

if ($resKey->num_rows === 0) {
    $stmtKey->close();
    http_response_code(403);
    echo json_encode(["error" => "Device not recognized or active"]);
    exit;
}

$rowKey = $resKey->fetch_assoc();
$signingPubKeyB64 = $rowKey['signing_public_key'];
$stmtKey->close();

if (empty($signingPubKeyB64)) {
    http_response_code(426); // Upgrade Required
    echo json_encode(["error" => "Security Upgrade: Re-registration required for signing"]);
    exit;
}

// Helper: Convert Raw ECDSA Signature (r|s) to ASN.1 DER
function signatureRawToDer($sig)
{
    if (strlen($sig) !== 64)
        return false;
    $r = substr($sig, 0, 32);
    $s = substr($sig, 32, 32);

    // Add leading zero if MSB is 1 to indicate positive integer
    if (ord($r[0]) >= 0x80)
        $r = chr(0x00) . $r;
    if (ord($s[0]) >= 0x80)
        $s = chr(0x00) . $s;

    $rLen = chr(strlen($r));
    $sLen = chr(strlen($s));

    // Sequence: 0x30 + TotalLen + (Integer + Len + r) + (Integer + Len + s)
    $der = chr(0x02) . $rLen . $r . chr(0x02) . $sLen . $s;
    $totalLen = chr(strlen($der));
    return chr(0x30) . $totalLen . $der;
}

// Verify ECDSA Signature
try {
    // Strict Base64 Decoding
    $sigBin = base64_decode($clientSig, true);

    // PEM Generation
    // We strictly use signingPubKeyB64 as source of truth for PEM
    // Validate it is valid base64 first
    if (base64_decode($signingPubKeyB64, true) === false) {
        throw new Exception("Invalid Key Encoding");
    }

    if ($sigBin === false) {
        throw new Exception("Invalid Signature Encoding");
    }

    // Convert Raw (WebCrypto) to DER (OpenSSL)
    $derSig = signatureRawToDer($sigBin);
    if (!$derSig) {
        throw new Exception("Invalid Raw Signature Length");
    }

    // Format as PEM for OpenSSL
    $pem = "-----BEGIN PUBLIC KEY-----\n" .
        chunk_split($signingPubKeyB64, 64, "\n") .
        "-----END PUBLIC KEY-----\n";

    // OpenSSL Verify (SHA256)
    $verified = openssl_verify($rawBody, $derSig, $pem, OPENSSL_ALGO_SHA256);

    if ($verified !== 1) {
        error_log("Signature Mismatch (ECDSA): ID=$msgId User=$userId Device=$deviceUuid OpenSSL=$verified");
        http_response_code(401);
        echo json_encode(["error" => "Integrity check failed: Invalid Signature"]);
        exit;
    }
} catch (Exception $e) {
    error_log("Crypto Error: " . $e->getMessage());
    http_response_code(401);
    echo json_encode(["error" => "Integrity check failed: Crypto Error"]);
    exit;
}

// 4. NONCE UNIQUENESS (Replay Protection - Strict INSERT Only)
// Removed redundant SELECT. Rely on Unique Constraint.

// 5. PERSIST NONCE (Optimistic Lock)
try {
    $ins = $conn->prepare("INSERT INTO message_replay_log (message_id, sender_id, device_uuid) VALUES (?, ?, ?)");
    $ins->bind_param("sss", $msgId, $userId, $deviceUuid);
    if (!$ins->execute()) {
        // Checking error code specifically for duplicate could be better, but exception covers it
        if ($conn->errno === 1062) { // 1062 = Duplicate entry
            throw new Exception("Duplicate entry");
        }
        throw new Exception("Insert failed");
    }
} catch (Exception $e) {
    http_response_code(409);
    echo json_encode(["error" => "Replay detected: Message ID already exists"]);
    exit;
}

// 5.5 SERVER SEQUENCE ASSIGNMENT (Epic 13: Ordering Guarantees)
// Atomic sequence generation using INSERT ON DUPLICATE KEY UPDATE
$serverSeq = null;
$serverReceivedAt = date('Y-m-d H:i:s');

try {
    // Upsert to get next sequence atomically
    $seqStmt = $conn->prepare("
        INSERT INTO chat_sequences (chat_id, last_seq) 
        VALUES (?, 1)
        ON DUPLICATE KEY UPDATE last_seq = last_seq + 1
    ");
    $seqStmt->bind_param("s", $chatId);
    $seqStmt->execute();
    $seqStmt->close();

    // Fetch the assigned sequence
    $fetchSeq = $conn->prepare("SELECT last_seq FROM chat_sequences WHERE chat_id = ?");
    $fetchSeq->bind_param("s", $chatId);
    $fetchSeq->execute();
    $seqResult = $fetchSeq->get_result();
    if ($seqResult->num_rows > 0) {
        $serverSeq = (int) $seqResult->fetch_assoc()['last_seq'];
    }
    $fetchSeq->close();
} catch (Exception $e) {
    error_log("Sequence generation failed: " . $e->getMessage());
    // Continue without sequence (fallback to timestamp ordering)
}

// Add server fields to input for Firestore
$input['server_seq'] = $serverSeq;
$input['server_received_at'] = $serverReceivedAt;

// 6. FIRESTORE WRITE (Via REST API)
$accessToken = getAccessToken('../service-account.json');
if (is_array($accessToken)) {
    // START COMPENSATION: Rollback Nonce (Strict Prepared Statement)
    $del = $conn->prepare("DELETE FROM message_replay_log WHERE message_id = ?");
    $del->bind_param("s", $msgId);
    $del->execute();
    $del->close();
    // END COMPENSATION

    http_response_code(500);
    echo json_encode($accessToken);
    exit;
}

$projectId = 'chatflect';
$firestoreUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/chats/$chatId/messages/$msgId"; // PUT implies create/replace

// STRICT FIX: Correct Firestore Type Mapping
function mapToFirestoreValue($val)
{
    if (is_int($val))
        return ["integerValue" => (string) $val]; // Int64 string
    if (is_float($val))
        return ["doubleValue" => $val];        // Double number (not string!)
    if (is_bool($val))
        return ["booleanValue" => $val];
    if (is_array($val)) {
        // Detect Associative vs Indexed Array
        $isAssoc = array_keys($val) !== range(0, count($val) - 1);
        if (empty($val))
            $isAssoc = false; // Empty array -> arrayValue usually

        if ($isAssoc) {
            return ["mapValue" => ["fields" => array_map('mapToFirestoreValue', $val)]];
        } else {
            return ["arrayValue" => ["values" => array_map('mapToFirestoreValue', $val)]];
        }
    }
    return ["stringValue" => (string) $val];
}

$firestoreFields = array_map('mapToFirestoreValue', $input);
$firestoreBody = ["fields" => $firestoreFields];

// Write Message (Result Checked Later)
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $firestoreUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($firestoreBody));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $accessToken",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$fsResult = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode >= 400) {
    // STRICT FIX: Compensation - Rollback Nonce (Prepared)
    $del = $conn->prepare("DELETE FROM message_replay_log WHERE message_id = ?");
    $del->bind_param("s", $msgId);
    $del->execute();

    http_response_code(500);
    echo json_encode(["error" => "Firestore Write Failed", "details" => json_decode($fsResult)]);
    exit;
}


// 7. METADATA UPDATE (Strict Backend Responsibility)
// Update lastTimestamp in chats/{chatId} using SERVER TIME
$metaUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/chats/$chatId?updateMask.fieldPaths=lastTimestamp";
$metaBody = [
    "fields" => [
        "lastTimestamp" => ["integerValue" => (string) $serverTime] // STRICT: Use Server Time
    ]
];
// Use PATCH for partial update
$chM = curl_init();
curl_setopt($chM, CURLOPT_URL, $metaUrl);
curl_setopt($chM, CURLOPT_CUSTOMREQUEST, 'PATCH');
curl_setopt($chM, CURLOPT_POSTFIELDS, json_encode($metaBody));
curl_setopt($chM, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $accessToken",
    "Content-Type: application/json"
]);
curl_setopt($chM, CURLOPT_RETURNTRANSFER, true);
$resM = curl_exec($chM);
curl_close($chM);

// 8. PERSIST IDEMPOTENCY RECORD (Epic 12)
// This ensures future duplicate sends return the same response
$receiverUid = $input['receiverUserId'] ?? $input['pid'] ?? 'unknown';
$stmtIdemIns = $conn->prepare("INSERT IGNORE INTO message_idempotency (message_uuid, sender_uid, receiver_uid, chat_id, processed_at) VALUES (?, ?, ?, ?, NOW())");
$stmtIdemIns->bind_param("ssss", $messageUuid, $userId, $receiverUid, $chatId);
$stmtIdemIns->execute();
$stmtIdemIns->close();

// STRICT FIX: Single JSON Response with message_uuid
echo json_encode([
    "status" => "success",
    "id" => $msgId,
    "message_uuid" => $messageUuid,
    "duplicate" => false,
    "firestore_result" => json_decode($fsResult)
]);
