<?php
// api/v3/rotate_signed_prekey.php
require_once '../auth_middleware.php';
require_once '../db_connect.php';

// Allow CORS (Strict for Cookies)
$allowed = ['http://localhost:8100', 'http://localhost:4200', 'capacitor://localhost', 'http://localhost'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$userId = requireAuth();
if (!$userId) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);

if (!isset($input['keyId'], $input['publicKey'], $input['signature'], $input['deviceId'])) {
    http_response_code(400);
    echo json_encode(["error" => "Missing required fields"]);
    exit;
}

$deviceId = (int) $input['deviceId'];
$keyId = (int) $input['keyId'];
$publicKey = $input['publicKey'];
$signature = $input['signature'];

// Start Transaction
$conn->begin_transaction();

try {
    // 1. Verify Signature against Identity Key
    // Fetch Identity Key
    $stmt = $conn->prepare("SELECT public_key FROM identity_keys WHERE user_id = ? AND device_id = ?");
    $stmt->bind_param("si", $userId, $deviceId);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        throw new Exception("Identity Key not found. Cannot rotate.");
    }

    // NOTE: In a REAL LibSignal server, we technically don't verify the signature server-side 
    // because the server usually just stores blobs. Verification is done by Peers.
    // However, to prevent "garbage injection", we SHOULD verify if we can.
    // PHP doesn't have native Curve25519/Ed25519 verify without extensions (sodium).
    // For MVP Phase 2: We TRUST the authenticated client (JWT) to upload a valid signature.
    // The Client (Angular) will verify signatures on fetch.

    // 2. Mark Old Inactive
    $upd = $conn->prepare("UPDATE signed_pre_keys SET is_active = 0 WHERE user_id = ? AND device_id = ?");
    $upd->bind_param("si", $userId, $deviceId);
    $upd->execute();

    // 3. Insert New
    $ins = $conn->prepare("INSERT INTO signed_pre_keys (user_id, device_id, key_id, public_key, signature, is_active) VALUES (?, ?, ?, ?, ?, 1)");
    $ins->bind_param("siiss", $userId, $deviceId, $keyId, $publicKey, $signature);
    $ins->execute();

    // 4. Audit Log
    $audit = $conn->prepare("INSERT INTO prekey_audit_log (actor_user_id, target_user_id, target_device_id, action_type, ip_address) VALUES (?, ?, ?, 'ROTATE_SPK', ?)");
    $ip = $_SERVER['REMOTE_ADDR'];
    $audit->bind_param("ssis", $userId, $userId, $deviceId, $ip);
    $audit->execute();

    $conn->commit();
    echo json_encode(["status" => "success", "keyId" => $keyId]);

} catch (Exception $e) {
    $conn->rollback();
    error_log("Rotate SPK Failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Rotation Failed"]);
}
?>