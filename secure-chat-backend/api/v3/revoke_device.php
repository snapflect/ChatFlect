<?php
// api/v3/revoke_device.php
require_once '../auth_middleware.php';
require_once '../db_connect.php'; // v3 path
require_once '../audit_log.php';

// Allow CORS
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

// 1. Authenticate User
$userId = requireAuth();

// 2. Parse Input
$input = json_decode(file_get_contents("php://input"), true);
$deviceUuid = $input['device_uuid'] ?? null;

if (!$deviceUuid) {
    http_response_code(400);
    echo json_encode(["error" => "device_uuid required"]);
    exit;
}

// 3. Identification & Logic
$conn->begin_transaction();

try {
    // A. Verify Ownership & Get Signal Device ID (for key wiping)
    $stmt = $conn->prepare("SELECT libsignal_device_id, status FROM user_devices WHERE user_id = ? AND device_uuid = ? FOR UPDATE");
    $stmt->bind_param("ss", $userId, $deviceUuid);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        throw new Exception("Device not found or not owned by user.");
    }

    $deviceParams = $res->fetch_assoc();
    $signalDeviceId = (int) $deviceParams['libsignal_device_id'];
    $currentStatus = $deviceParams['status'];

    if ($currentStatus === 'revoked') {
        // Already revoked, return success (Idempotent)
        $conn->rollback(); // Release lock
        echo json_encode(["status" => "success", "message" => "Device already revoked"]);
        exit;
    }

    // B. Revoke Device (Soft Delete in Registry)
    $upd = $conn->prepare("UPDATE user_devices SET status = 'revoked', revoked_at = NOW(), last_active = NOW() WHERE user_id = ? AND device_uuid = ?");
    $upd->bind_param("ss", $userId, $deviceUuid);
    $upd->execute();

    // C. Wipe Sessions (Hard Delete - Immediate Session Kill)
    $delSess = $conn->prepare("DELETE FROM user_sessions WHERE user_id = ? AND device_uuid = ?");
    $delSess->bind_param("ss", $userId, $deviceUuid);
    $delSess->execute();

    // D. Wipe Cryptographic Keys (Hard Delete - Prevent Decryption)
    // Delete One-Time PreKeys
    $delPK = $conn->prepare("DELETE FROM pre_keys WHERE user_id = ? AND device_id = ?");
    $delPK->bind_param("si", $userId, $signalDeviceId);
    $delPK->execute();

    // Delete Signed PreKeys
    $delSPK = $conn->prepare("DELETE FROM signed_pre_keys WHERE user_id = ? AND device_id = ?");
    $delSPK->bind_param("si", $userId, $signalDeviceId);
    $delSPK->execute();

    // E. Audit Log
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    auditLog('DEVICE_REVOKED', $userId, [
        'device_uuid' => $deviceUuid,
        'signal_device_id' => $signalDeviceId,
        'ip' => $ip
    ]);

    $conn->commit();

    echo json_encode(["status" => "success", "message" => "Device revoked and keys wiped."]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
    error_log("Revoke Failed: " . $e->getMessage());
}
