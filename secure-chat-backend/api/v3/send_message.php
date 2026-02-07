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

// 2. Parse Input
$input = json_decode(file_get_contents("php://input"), true);
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

// 3.5 SIGNATURE VERIFICATION (Anti-Tamper - Story 5.2)
$headers = getallheaders();
$clientSig = $headers['X-Signal-Metadata-Signature'] ?? $headers['x-signal-metadata-signature'] ?? '';
$rawBody = file_get_contents("php://input");

// In production, fetch this from Environment/Secret Manager
$integritySecret = 'CHATFLECT_APP_INTEGRITY_SECRET_V1';

$expectedSig = hash_hmac('sha256', $rawBody, $integritySecret);

if (!hash_equals($expectedSig, $clientSig)) {
    // Audit warning?
    error_log("Signature Mismatch: ID=$msgId User=$userId Expected=$expectedSig Got=$clientSig");
    http_response_code(401);
    echo json_encode(["error" => "Integrity check failed: Invalid Signature"]);
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

// 5. PERSIST NONCE
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
    http_response_code(500);
    echo json_encode($accessToken);
    exit;
}

$projectId = 'chatflect'; // Hardcoded or fetch from config
$firestoreUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/chats/$chatId/messages/$msgId";

// Firestore REST Format is strict. We need to map JSON payload to Firestore Value format.
function mapToFirestoreValue($val)
{
    if (is_int($val) || is_float($val))
        return ["integerValue" => (string) $val];
    if (is_bool($val))
        return ["booleanValue" => $val];
    if (is_array($val))
        return ["mapValue" => ["fields" => array_map('mapToFirestoreValue', $val)]];
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
    // Write Failed - Rollback Nonce?
    // Ideally yes, but replay log prevents retry.
    // If we fail to write to FS, the client should generate a NEW ID to retry.
    // So keeping the nonce as "burned" is actually safer for Replay attacks.
    http_response_code(500);
    echo json_encode(["error" => "Firestore Write Failed", "details" => $fsResult]);
    exit;
}

echo json_encode(["status" => "success", "id" => $msgId]);
