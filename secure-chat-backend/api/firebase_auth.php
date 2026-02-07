<?php
/**
 * Firebase Auth Bridge
 * Exchanges a valid PHP session/token for a Firebase Custom Token.
 * 
 * Usage:
 * POST /api/firebase_auth.php
 * Headers: Authorization: Bearer <token>
 * Body: { "user_id": "..." }
 */

require_once 'db.php';
require_once 'rate_limiter.php';
require_once 'auth_middleware.php'; // Verifies the Bearer token
require_once 'SimpleJWT.php';

enforceRateLimit(null, 10, 60); // 10 req/min/IP
header('Content-Type: application/json');

// 1. Verify User is logged in via PHP backend (Session or Bearer)
$userId = requireAuth(); // Returns user_id string or exits with 401

// 2. Validate Device Binding (Strict Zero-Trust)
$rawInput = file_get_contents("php://input");
$input = json_decode($rawInput, true);
$deviceUuid = $input['device_uuid'] ?? null;

if (!$deviceUuid) {
    http_response_code(400);
    echo json_encode(["error" => "device_uuid required for token binding"]);
    exit;
}

// 3. Verify Device Ownership & Status in DB
global $conn;
$stmt = $conn->prepare("SELECT status, revoked_at FROM user_devices WHERE user_id = ? AND device_uuid = ?");
$stmt->bind_param("ss", $userId, $deviceUuid);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) {
    http_response_code(403);
    echo json_encode(["error" => "Device not registered"]);
    exit;
}

$row = $res->fetch_assoc();
if ($row['status'] !== 'active' || $row['revoked_at'] !== null) {
    http_response_code(403);
    echo json_encode(["error" => "Device is not active or has been revoked"]);
    exit;
}

// 4. Load Service Account Key
$keyPath = __DIR__ . '/service-account.json';
if (!file_exists($keyPath)) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Service Account Key missing on server."]);
    exit;
}

$serviceAccount = json_decode(file_get_contents($keyPath), true);
if (!$serviceAccount || !isset($serviceAccount['client_email']) || !isset($serviceAccount['private_key'])) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Invalid Service Account configuration."]);
    exit;
}

try {
    // 5. Generate Token
    // v16.0: Ensure UID is normalized
    $firebaseUid = strtoupper(trim($userId));

    // Add claims: Role + DEVICE BINDING
    $claims = [
        'is_verified' => true,
        'device_uuid' => $deviceUuid // Critical for Story 4.1
    ];

    $token = SimpleJWT::createCustomToken(
        $serviceAccount['client_email'],
        $serviceAccount['private_key'],
        $firebaseUid,
        $claims
    );

    echo json_encode([
        "status" => "success",
        "firebase_token" => $token,
        "uid" => $firebaseUid,
        "device_bind" => $deviceUuid
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Token generation failed: " . $e->getMessage()]);
}
