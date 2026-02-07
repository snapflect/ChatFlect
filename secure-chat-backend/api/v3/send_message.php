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

// 3.5 SIGNATURE VERIFICATION (STRICT FIX: Ed25519 Identity Signature)
$headers = getallheaders();
$clientSig = $headers['X-Signal-Metadata-Signature'] ?? $headers['x-signal-metadata-signature'] ?? '';

if (empty($clientSig)) {
    http_response_code(401);
    echo json_encode(["error" => "Missing Integrity Signature"]);
    exit;
}

// Fetch Device Identity Key
$stmtKey = $conn->prepare("SELECT public_key FROM user_devices WHERE user_id = ? AND device_uuid = ? AND status = 'active'");
$stmtKey->bind_param("ss", $userId, $deviceUuid);
$stmtKey->execute();
$resKey = $stmtKey->get_result();

if ($resKey->num_rows === 0) {
    $stmtKey->close();
    http_response_code(403);
    echo json_encode(["error" => "Device not recognized or inactive"]);
    exit;
}

$rowKey = $resKey->fetch_assoc();
$devicePubKeyB64 = $rowKey['public_key']; // Expected to be Base64
$stmtKey->close();

// Verify Ed25519 Signature
// PHP Sodium extension required
if (!function_exists('sodium_crypto_sign_verify_detached')) {
    error_log("CRITICAL: Sodium extension missing for signature verification");
    http_response_code(500);
    echo json_encode(["error" => "Server crypto configuration error"]);
    exit;
}

try {
    $sigBin = base64_decode($clientSig);
    $pubKeyBin = base64_decode($devicePubKeyB64);

    // LibSignal Identity Keys have a type byte (0x05) prefix? 
    // Usually yes (DJB type). Sodium expects raw 32 bytes for Ed25519.
    // If key has prefix (33 bytes), strip first byte.
    if (strlen($pubKeyBin) === 33) {
        $pubKeyBin = substr($pubKeyBin, 1);
    }

    // Message is the Raw Body
    $verified = sodium_crypto_sign_verify_detached($sigBin, $rawBody, $pubKeyBin);

    if (!$verified) {
        error_log("Signature Mismatch: ID=$msgId User=$userId Device=$deviceUuid");
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
// Check if message_id already processed
$stmt = $conn->prepare("SELECT message_id FROM message_replay_log WHERE message_id = ?");
$stmt->bind_param("s", $msgId);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    http_response_code(409); // Conflict
    echo json_encode(["error" => "Replay detected: Message ID already exists"]);
    exit;
}
$stmt->close();

// 5. PERSIST NONCE (Optimistic Lock)
// Log immediately to block race conditions
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
// Authenticate as Service Account
$accessToken = getAccessToken('../service-account.json');
if (is_array($accessToken)) {
    // START COMPENSATION: Rollback Nonce
    $conn->query("DELETE FROM message_replay_log WHERE message_id = '$msgId'");
    // END COMPENSATION

    http_response_code(500);
    echo json_encode($accessToken);
    exit;
}

$projectId = 'chatflect'; // Hardcoded or fetch from config
$firestoreUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/chats/$chatId/messages/$msgId";
// Note: updateMask is complex via REST.
// Simplification: Just write the message document. Metadata update is separate or via Cloud Function.
// We strictly write the message doc here.


// STRICT FIX: Correct Firestore Type Mapping
function mapToFirestoreValue($val)
{
    if (is_int($val) || is_float($val))
        return ["integerValue" => (string) $val];
    if (is_bool($val))
        return ["booleanValue" => $val];
    if (is_array($val)) {
        // Detect Associative vs Indexed Array
        $isAssoc = array_keys($val) !== range(0, count($val) - 1);
        if ($isAssoc) {
            return ["mapValue" => ["fields" => array_map('mapToFirestoreValue', $val)]];
        } else {
            // It's a list/array
            return ["arrayValue" => ["values" => array_map('mapToFirestoreValue', $val)]];
        }
    }
    return ["stringValue" => (string) $val];
}

$firestoreFields = array_map('mapToFirestoreValue', $input);
$firestoreBody = ["fields" => $firestoreFields];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $firestoreUrl); // PUT to create/overwrite
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH'); // Use PATCH to upsert
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
    // STRICT FIX: Compensation - Rollback Nonce if Firestore fails
    $conn->query("DELETE FROM message_replay_log WHERE message_id = '$msgId'");

    http_response_code(500);
    echo json_encode(["error" => "Firestore Write Failed", "details" => $fsResult]);
    exit;
}

echo json_encode(["status" => "success", "id" => $msgId]);
