<?php
// api/v3/approve_device.php
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

// 3. Logic
try {
    // A. Verify Ownership & Current Status
    $stmt = $conn->prepare("SELECT status FROM user_devices WHERE user_id = ? AND device_uuid = ?");
    $stmt->bind_param("ss", $userId, $deviceUuid);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["error" => "Device not found"]);
        exit;
    }

    $row = $res->fetch_assoc();
    $currentStatus = $row['status'];

    if ($currentStatus === 'active') {
        echo json_encode(["status" => "success", "message" => "Device is already active"]);
        exit;
    }

    // B. Approve Device
    // Reset revoked_at to NULL, set status to active
    $upd = $conn->prepare("UPDATE user_devices SET status = 'active', revoked_at = NULL, last_active = NOW() WHERE user_id = ? AND device_uuid = ?");
    $upd->bind_param("ss", $userId, $deviceUuid);

    if ($upd->execute()) {
        // C. Audit Log
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        auditLog('DEVICE_APPROVED', $userId, [
            'device_uuid' => $deviceUuid,
            'previous_status' => $currentStatus,
            'ip' => $ip
        ]);

        echo json_encode(["status" => "success", "message" => "Device approved successfully"]);
    } else {
        throw new Exception("Database update failed");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
    error_log("Approve Device Failed: " . $e->getMessage());
}
