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

// 3. TIMESTAMP VALIDATION (Anti-Tamper / Skew Check)
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

// Verify ECDSA Signature
try {
    // Strict Base64 Decoding
    $sigBin = base64_decode($clientSig, true);
    $pubKeyBin = base64_decode($signingPubKeyB64, true);

    if ($sigBin === false || $pubKeyBin === false) {
        throw new Exception("Invalid Base64 Encoding");
    }

    // Format as PEM for OpenSSL
    $pem = "-----BEGIN PUBLIC KEY-----\n" .
        chunk_split($signingPubKeyB64, 64, "\n") .
        "-----END PUBLIC KEY-----\n";

    // OpenSSL Verify (SHA256)
    $verified = openssl_verify($rawBody, $sigBin, $pem, OPENSSL_ALGO_SHA256);

    if ($verified !== 1) {
        // 0 = Fail, -1 = Error
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

// 4. NONCE UNIQUENESS (Replay Protection)
$stmt = $conn->prepare("SELECT message_id FROM message_replay_log WHERE message_id = ?");
$stmt->bind_param("s", $msgId);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    http_response_code(409);
    echo json_encode(["error" => "Replay detected: Message ID already exists"]);
    exit;
}
$stmt->close();

// 5. PERSIST NONCE (Optimistic Lock)
try {
    $ins = $conn->prepare("INSERT INTO message_replay_log (message_id, sender_id, device_uuid) VALUES (?, ?, ?)");
    $ins->bind_param("sss", $msgId, $userId, $deviceUuid);
    if (!$ins->execute()) {
        throw new Exception("Duplicate entry race condition");
    }
} catch (Exception $e) {
    http_response_code(409);
    echo json_encode(["error" => "Replay detected (Race condition)"]);
    exit;
}

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
    echo json_encode(["error" => "Firestore Write Failed", "details" => $fsResult]);
    exit;
}


// 7. METADATA UPDATE (Strict Backend Responsibility)
// Update lastTimestamp in chats/{chatId}
$metaUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/chats/$chatId?updateMask.fieldPaths=lastTimestamp";
$metaBody = [
    "fields" => [
        "lastTimestamp" => ["integerValue" => (string) $timestamp] // timestamp is from input (validated)
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
// Fire and forget (or log warning). Don't fail the message if metadata update fails (eventual consistency).
$resM = curl_exec($chM);
curl_close($chM);

echo $fsResult; // Return the message object execution result

echo json_encode(["status" => "success", "id" => $msgId]);
