<?php
/**
 * Message Repair API
 * Epic 14: Repair Protocol (Missing Message Recovery)
 *
 * Endpoint: GET /v3/messages/repair
 * Returns encrypted message payloads in sequence order.
 */

require_once '../auth_middleware.php';
require_once '../db_connect.php';
require_once '../google_auth.php';

// CORS
$allowed = ['http://localhost:8100', 'http://localhost:4200', 'capacitor://localhost', 'http://localhost'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Device-UUID");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. Authenticate
$authData = requireAuth();
$userId = $authData['user_id'];
$deviceUuid = $authData['device_uuid'] ?? null;

// STRICT: Require device_uuid
if (empty($deviceUuid)) {
    http_response_code(400);
    echo json_encode(["error" => "MISSING_DEVICE_UUID", "message" => "Device UUID is required"]);
    exit;
}

// 1.5 DEVICE ACTIVE CHECK (Phase 1 Security Control)
// Ensure requesting device is active (not revoked)
$stmtDevice = $conn->prepare("SELECT status FROM user_devices WHERE user_id = ? AND device_uuid = ?");
$stmtDevice->bind_param("ss", $userId, $deviceUuid);
$stmtDevice->execute();
$deviceResult = $stmtDevice->get_result();

if ($deviceResult->num_rows === 0) {
    http_response_code(403);
    echo json_encode(["error" => "DEVICE_NOT_REGISTERED", "message" => "Device is not registered"]);
    exit;
}

$deviceRow = $deviceResult->fetch_assoc();
if ($deviceRow['status'] !== 'active') {
    http_response_code(403);
    echo json_encode(["error" => "DEVICE_REVOKED", "message" => "Device has been revoked. Please re-register."]);
    exit;
}
$stmtDevice->close();

// 2. Parse Query Parameters
$chatId = $_GET['chatId'] ?? null;
$fromSeq = isset($_GET['fromSeq']) ? (int) $_GET['fromSeq'] : null;
$toSeq = isset($_GET['toSeq']) ? (int) $_GET['toSeq'] : null;

if (!$chatId) {
    http_response_code(400);
    echo json_encode(["error" => "MISSING_CHAT_ID", "message" => "chatId is required"]);
    exit;
}

if ($fromSeq === null || $toSeq === null) {
    http_response_code(400);
    echo json_encode(["error" => "MISSING_RANGE", "message" => "fromSeq and toSeq are required"]);
    exit;
}

if ($fromSeq > $toSeq) {
    http_response_code(400);
    echo json_encode(["error" => "INVALID_RANGE", "message" => "fromSeq must be <= toSeq"]);
    exit;
}

// RANGE LIMITS (Abuse Prevention)
$maxRangeSize = 500;

if ($toSeq - $fromSeq > $maxRangeSize) {
    http_response_code(400);
    echo json_encode([
        "error" => "RANGE_TOO_LARGE",
        "message" => "Maximum $maxRangeSize messages per repair request",
        "max_range" => $maxRangeSize
    ]);
    exit;
}

if ($fromSeq < 1) {
    http_response_code(400);
    echo json_encode(["error" => "INVALID_FROM_SEQ", "message" => "fromSeq must be >= 1"]);
    exit;
}

// 3. Authorization Check - Verify user is participant in chat
$accessToken = getAccessToken('../service-account.json');
if (is_array($accessToken)) {
    http_response_code(500);
    echo json_encode(["error" => "AUTH_FAILED", "details" => $accessToken]);
    exit;
}

$projectId = 'chatflect';
$chatUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/chats/$chatId";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $chatUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $accessToken"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$chatResult = curl_exec($ch);
$chatHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($chatHttpCode === 404) {
    http_response_code(404);
    echo json_encode(["error" => "CHAT_NOT_FOUND", "message" => "Chat does not exist"]);
    exit;
}

$chatDoc = json_decode($chatResult, true);
$participants = [];

// Extract participants from Firestore document
if (isset($chatDoc['fields']['participants']['arrayValue']['values'])) {
    foreach ($chatDoc['fields']['participants']['arrayValue']['values'] as $p) {
        $participants[] = strtoupper($p['stringValue'] ?? '');
    }
}

if (!in_array(strtoupper($userId), $participants)) {
    http_response_code(403);
    echo json_encode(["error" => "NOT_AUTHORIZED", "message" => "User is not a participant in this chat"]);
    exit;
}

// 4. Fetch Messages in Range from Firestore
$messagesUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/chats/$chatId/messages";

// Use structured query for filtering by server_seq
$queryBody = [
    "structuredQuery" => [
        "from" => [["collectionId" => "messages"]],
        "where" => [
            "compositeFilter" => [
                "op" => "AND",
                "filters" => [
                    [
                        "fieldFilter" => [
                            "field" => ["fieldPath" => "server_seq"],
                            "op" => "GREATER_THAN_OR_EQUAL",
                            "value" => ["integerValue" => (string) $fromSeq]
                        ]
                    ],
                    [
                        "fieldFilter" => [
                            "field" => ["fieldPath" => "server_seq"],
                            "op" => "LESS_THAN_OR_EQUAL",
                            "value" => ["integerValue" => (string) $toSeq]
                        ]
                    ]
                ]
            ]
        ],
        "orderBy" => [["field" => ["fieldPath" => "server_seq"], "direction" => "ASCENDING"]],
        "limit" => $maxRangeSize
    ]
];

$queryUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents:runQuery";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $queryUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($queryBody));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $accessToken",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$queryResult = curl_exec($ch);
$queryHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($queryHttpCode >= 400) {
    http_response_code(500);
    echo json_encode(["error" => "QUERY_FAILED", "details" => json_decode($queryResult)]);
    exit;
}

// 5. Parse Query Results
$results = json_decode($queryResult, true);
$messages = [];

foreach ($results as $item) {
    if (!isset($item['document']))
        continue;

    $doc = $item['document'];
    $fields = $doc['fields'] ?? [];

    // Include message_uuid for client-side deduplication
    $msg = [
        "id" => basename($doc['name']),
        "message_uuid" => $fields['message_uuid']['stringValue'] ?? null,
        "server_seq" => isset($fields['server_seq']['integerValue'])
            ? (int) $fields['server_seq']['integerValue']
            : null,
        "timestamp" => isset($fields['timestamp']['integerValue'])
            ? (int) $fields['timestamp']['integerValue']
            : 0,
        "encrypted_payload" => $fields['encrypted']['stringValue'] ?? null,
        "sender_id" => $fields['senderId']['stringValue'] ?? null,
        "server_received_at" => $fields['server_received_at']['stringValue'] ?? null
    ];

    $messages[] = $msg;
}

if (empty($messages)) {
    http_response_code(404);
    echo json_encode([
        "error" => "NO_MESSAGES",
        "message" => "No messages found in the specified range",
        "from_seq" => $fromSeq,
        "to_seq" => $toSeq
    ]);
    exit;
}

// 6. Return Response
echo json_encode([
    "messages" => $messages,
    "total" => count($messages),
    "from_seq" => $fromSeq,
    "to_seq" => $toSeq,
    "chat_id" => $chatId
]);
