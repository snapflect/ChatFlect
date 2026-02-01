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

// 1. Verify User is logged in via PHP backend
$user = authenticateRequest(); // From auth_middleware.php, exits if failed
$userId = $user['user_id'];

// 2. Load Service Account Key
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
    // 3. Generate Token
    // v16.0: Ensure UID is normalized
    $firebaseUid = strtoupper(trim($userId));

    // Optional: Add claims like 'role' or 'premium'
    $claims = [
        'is_verified' => true
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
        "uid" => $firebaseUid
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Token generation failed: " . $e->getMessage()]);
}
