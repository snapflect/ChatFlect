<?php
/**
 * ZK-S Contact Salt Provider (HF-4.1)
 * Provides a device-specific salt for zero-knowledge contact hashing.
 * 
 * GET /api/auth_salt.php?user_id=...&device_uuid=...
 */

require_once 'db.php';
require_once 'auth_middleware.php';
require_once 'rate_limiter.php';

header('Content-Type: application/json; charset=utf-8');

// Enforce per-IP rate limit for salt requests
enforceRateLimit(null, 20, 60);

try {
    // 1. Authenticate Request
    $userId = requireAuth();

    // 2. Validate Inputs
    $deviceUuid = $_GET['device_uuid'] ?? null;
    if (!$deviceUuid) {
        http_response_code(400);
        echo json_encode(["error" => "device_uuid required"]);
        exit;
    }

    // 3. Verify Device Ownership
    global $conn;
    $stmt = $conn->prepare("SELECT salt FROM user_devices WHERE user_id = ? AND device_uuid = ? AND status = 'active'");
    $stmt->bind_param("ss", $userId, $deviceUuid);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        // Check if device exists but has no salt (Migrated from legacy)
        $stmt = $conn->prepare("SELECT id FROM user_devices WHERE user_id = ? AND device_uuid = ?");
        $stmt->bind_param("ss", $userId, $deviceUuid);
        $stmt->execute();
        if ($stmt->get_result()->num_rows === 0) {
            http_response_code(403);
            echo json_encode(["error" => "Access denied or device not registered"]);
            exit;
        }

        // Generate and Update Salt for legacy devices
        $newSalt = bin2hex(random_bytes(16));
        $update = $conn->prepare("UPDATE user_devices SET salt = ? WHERE user_id = ? AND device_uuid = ?");
        $update->bind_param("sss", $newSalt, $userId, $deviceUuid);
        $update->execute();

        echo json_encode(["success" => true, "salt" => $newSalt]);
        exit;
    }

    $row = $res->fetch_assoc();
    $salt = $row['salt'];

    if (!$salt) {
        $salt = bin2hex(random_bytes(16));
        $update = $conn->prepare("UPDATE user_devices SET salt = ? WHERE user_id = ? AND device_uuid = ?");
        $update->bind_param("sss", $salt, $userId, $deviceUuid);
        $update->execute();
    }

    echo json_encode(["success" => true, "salt" => $salt]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => "Internal Server Error", "message" => $e->getMessage()]);
}
