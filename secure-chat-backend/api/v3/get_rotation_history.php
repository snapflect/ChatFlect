<?php
// api/v3/get_rotation_history.php
require_once '../auth_middleware.php';
require_once '../db_connect.php';

// Allow CORS
$allowed = ['http://localhost:8100', 'http://localhost:4200', 'capacitor://localhost', 'http://localhost'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json");

$userId = requireAuth();
if (!$userId) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

$deviceId = isset($_GET['deviceId']) ? intval($_GET['deviceId']) : 0;

if ($deviceId <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "Missing deviceId"]);
    exit;
}

// Security Check: Ensure user owns this device (optional but good)
// Actually the query filters by user_id so it's safe.

try {
    $stmt = $conn->prepare("
        SELECT old_key_version, new_key_version, signed_prekey_id, rotated_at, event_type
        FROM signed_prekey_rotations
        WHERE user_id = ? AND device_id = ?
        ORDER BY rotated_at DESC
        LIMIT 20
    ");
    $stmt->bind_param("si", $userId, $deviceId);
    $stmt->execute();

    $res = $stmt->get_result();
    $data = [];

    while ($row = $res->fetch_assoc()) {
        $data[] = $row;
    }

    echo json_encode([
        "status" => "success",
        "history" => $data
    ]);
} catch (Exception $e) {
    error_log("History Fetch Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Internal Server Error"]);
}
