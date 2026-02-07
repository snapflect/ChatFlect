<?php
require 'db.php';
require_once 'rate_limiter.php';
require_once 'audit_log.php';
require_once 'auth_middleware.php';
require_once 'CryptoUtils.php';

// Enforce rate limiting
enforceRateLimit();

header('Content-Type: application/json');

// SECURITY FIX (J4): Enforce authentication for all operations
// This prevents unauthenticated device registration attacks
$authUserId = requireAuth();

// --- 1. Database Schema Check/Create (One-time or idempotent) ---
// In production, this should be a migration script.
$createTableQuery = "CREATE TABLE IF NOT EXISTS user_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    device_uuid VARCHAR(64) NOT NULL,
    public_key TEXT NOT NULL,
    fcm_token TEXT,
    device_name VARCHAR(100) DEFAULT 'Unknown Device',
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    signature TEXT,
    bundle_version INT DEFAULT 1,
    UNIQUE KEY unique_device (user_id, device_uuid),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
)";
$conn->query($createTableQuery);

// Migration: Ensure fcm_token, device_name, signature, bundle_version, libsignal_device_id exist
// Using try-catch with error suppression for "duplicate column" scenarios
$migrations = [
    "ALTER TABLE user_devices ADD COLUMN fcm_token TEXT",
    "ALTER TABLE user_devices ADD COLUMN device_name VARCHAR(100) DEFAULT 'Unknown Device'",
    "ALTER TABLE user_devices ADD COLUMN signature TEXT",
    "ALTER TABLE user_devices ADD COLUMN bundle_version INT DEFAULT 1",
    "ALTER TABLE user_devices ADD COLUMN signed_at VARCHAR(40)",
    "ALTER TABLE user_devices ADD COLUMN libsignal_device_id INT DEFAULT 1" // Standard Signal Device ID
];

foreach ($migrations as $sql) {
    try {
        if (!$conn->query($sql)) {
            // Check if error is NOT "Duplicate column" (Code 1060)
            if ($conn->errno !== 1060) {
                error_log("Migration failed: " . $conn->error);
            }
        }
    } catch (Exception $e) {
        // Find safe way to ignore
    }
}


$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);

    // REGISTER DEVICE
    if ($action === 'register') {
        $userId = isset($data['user_id']) ? trim(strtoupper($data['user_id'])) : ''; // v16.0 Zero-Trust Normalization
        $deviceUuid = $data['device_uuid'] ?? '';
        $publicKey = $data['public_key'] ?? '';
        $deviceName = $data['device_name'] ?? 'Mobile Device';
        $fcmToken = $data['fcm_token'] ?? null;

        if (!$userId || !$deviceUuid || !$publicKey) {
            http_response_code(400);
            echo json_encode(["error" => "Missing fields"]);
            exit;
        }

        // SECURITY FIX (J4): Validate user_id matches authenticated user
        if (strtoupper($userId) !== strtoupper($authUserId)) {
            auditLog('DEVICE_REGISTER_FORBIDDEN', $authUserId, [
                'attempted_user_id' => $userId,
                'reason' => 'user_mismatch'
            ]);
            http_response_code(403);
            echo json_encode([
                "error" => "Forbidden - Cannot register devices for other users",
                "auth_user" => $authUserId
            ]);
            exit;
        }

        // --- SECURITY FIX (E1): Generate Signed Key Bundle ---
        $bundleVersion = 2;
        $timestamp = date('c'); // ISO 8601, Exact time of signing

        // Canonical payload: user_id|device_uuid|public_key|timestamp|version
        // We MUST store this exact timestamp ($timestamp) to allow verification later.
        $canonicalData = CryptoUtils::createCanonicalString($userId, $deviceUuid, $publicKey, $timestamp, $bundleVersion);
        $signature = CryptoUtils::signPayload($canonicalData);

        // --- Multi-Device Session Hardening (v8.1) ---
        $MAX_DEVICES = 5;
        $countStmt = $conn->prepare("SELECT COUNT(*) as count FROM user_devices WHERE user_id = ?");
        if ($countStmt) {
            $countStmt->bind_param("s", $userId);
            $countStmt->execute();
            $countRes = $countStmt->get_result()->fetch_assoc();
            $countStmt->close();
        } else {
            $countRes = ['count' => 0]; // Fail safe
        }

        // Check if device already exists (update doesn't count towards limit)
        $existsStmt = $conn->prepare("SELECT 1 FROM user_devices WHERE user_id = ? AND device_uuid = ?");
        $isUpdate = false;
        if ($existsStmt) {
            $existsStmt->bind_param("ss", $userId, $deviceUuid);
            $existsStmt->execute();
            $isUpdate = $existsStmt->get_result()->num_rows > 0;
            $existsStmt->close();
        }

        if (!$isUpdate && isset($countRes['count']) && $countRes['count'] >= $MAX_DEVICES) {
            // Find the oldest device
            $oldestStmt = $conn->prepare("SELECT device_uuid FROM user_devices WHERE user_id = ? ORDER BY last_active ASC LIMIT 1");
            if ($oldestStmt) {
                $oldestStmt->bind_param("s", $userId);
                $oldestStmt->execute();
                $oldest = $oldestStmt->get_result()->fetch_assoc();
                $oldestStmt->close();

                if ($oldest) {
                    // Evict oldest device
                    $evictStmt = $conn->prepare("DELETE FROM user_devices WHERE user_id = ? AND device_uuid = ?");
                    if ($evictStmt) {
                        $evictStmt->bind_param("ss", $userId, $oldest['device_uuid']);
                        $evictStmt->execute();
                        $evictStmt->close();
                    }

                    // Clear sessions associated with evicted device
                    $sessStmt = $conn->prepare("DELETE FROM user_sessions WHERE user_id = ? AND device_uuid = ?");
                    if ($sessStmt) {
                        $sessStmt->bind_param("ss", $userId, $oldest['device_uuid']);
                        $sessStmt->execute();
                        $sessStmt->close();
                    }

                    auditLog('DEVICE_EVICTED_MAX_LIMIT', $userId, [
                        'evicted_device' => $oldest['device_uuid'],
                        'new_device' => $deviceUuid,
                        'reason' => 'max_limit_reached'
                    ]);
                }
            }
        }

        // Determine Signal Device ID (Auto-Increment per User)
        $sigId = 1;

        // Check if device already exists to preserve its ID
        $existingParams = $conn->prepare("SELECT libsignal_device_id FROM user_devices WHERE user_id = ? AND device_uuid = ?");
        $existingParams->bind_param("ss", $userId, $deviceUuid);
        $existingParams->execute();
        $exRes = $existingParams->get_result();

        if ($exRes->num_rows > 0) {
            $row = $exRes->fetch_assoc();
            $sigId = (int) $row['libsignal_device_id'];
        } else {
            // New Device: Find max ID + 1
            $maxStmt = $conn->prepare("SELECT MAX(libsignal_device_id) as max_id FROM user_devices WHERE user_id = ?");
            $maxStmt->bind_param("s", $userId);
            $maxStmt->execute();
            $maxRes = $maxStmt->get_result()->fetch_assoc();
            $sigId = ($maxRes['max_id'] ?? 0) + 1;
            // Cap at 10? Signal allows more, but our logic limits to 5 devices anyway.
        }

        // Upsert device
        // FIX: Store signed_at timestamp and libsignal_device_id
        $stmt = $conn->prepare("INSERT INTO user_devices (user_id, device_uuid, public_key, device_name, fcm_token, signature, bundle_version, signed_at, libsignal_device_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                ON DUPLICATE KEY UPDATE public_key = ?, device_name = ?, fcm_token = ?, signature = ?, bundle_version = ?, signed_at = ?, libsignal_device_id = ?, last_active = NOW()");

        if (!$stmt) {
            http_response_code(500);
            echo json_encode(["error" => "Database error: " . $conn->error]);
            exit;
        }

        $stmt->bind_param(
            "ssssssisississisi", // types
            $userId,
            $deviceUuid,
            $publicKey,
            $deviceName,
            $fcmToken,
            $signature,
            $bundleVersion,
            $timestamp,
            $sigId, // new param

            $publicKey, // update params
            $deviceName,
            $fcmToken,
            $signature,
            $bundleVersion,
            $timestamp,
            $sigId
        );

        if ($stmt->execute()) {
            auditLog('device_registered', $userId, ['device_uuid' => $deviceUuid]);
            echo json_encode(["status" => "success", "message" => "Device registered"]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Failed to register device: " . $stmt->error]);
        }
    }
} elseif ($method === 'GET') {

    // LIST DEVICES
    if ($action === 'list') {
        $userId = isset($_GET['user_id']) ? trim(strtoupper($_GET['user_id'])) : '';
        if (!$userId) {
            http_response_code(400);
            echo json_encode(["error" => "User ID required"]);
            exit;
        }

        // SECURITY FIX (J4): Validate user can only list their own devices
        // UPDATE (Story 2.5): Allow listing other users' devices for Signal Protocol discovery
        // if (strtoupper($userId) !== strtoupper($authUserId)) {
        //     http_response_code(403);
        //     echo json_encode(["error" => "Forbidden - Cannot list devices for other users"]);
        //     exit;
        // }

        $stmt = $conn->prepare("SELECT device_uuid, device_name, last_active, created_at, libsignal_device_id FROM user_devices WHERE user_id = ?");
        $stmt->bind_param("s", $userId);
        $stmt->execute();
        $result = $stmt->get_result();

        $devices = [];
        while ($row = $result->fetch_assoc()) {
            $devices[] = $row;
        }

        echo json_encode($devices);
    }

} elseif ($method === 'DELETE') {

    // REVOKE DEVICE
    $data = json_decode(file_get_contents("php://input"), true);
    $userId = isset($data['user_id']) ? trim(strtoupper($data['user_id'])) : '';
    $deviceUuid = $data['device_uuid'] ?? '';

    if (!$userId || !$deviceUuid) {
        http_response_code(400);
        echo json_encode(["error" => "User ID and Device UUID required"]);
        exit;
    }

    // SECURITY FIX (J4): Validate user can only revoke their own devices
    if (strtoupper($userId) !== strtoupper($authUserId)) {
        auditLog('DEVICE_REVOKE_FORBIDDEN', $authUserId, [
            'attempted_user_id' => $userId,
            'device_uuid' => $deviceUuid
        ]);
        http_response_code(403);
        echo json_encode(["error" => "Forbidden - Cannot revoke devices for other users"]);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM user_devices WHERE user_id = ? AND device_uuid = ?");
    $stmt->bind_param("ss", $userId, $deviceUuid);

    // v13: Immediate Session Invalidation (Revoke & Wipe)
    $sessStmt = $conn->prepare("DELETE FROM user_sessions WHERE user_id = ? AND device_uuid = ?");
    $sessStmt->bind_param("ss", $userId, $deviceUuid);
    $sessStmt->execute();

    if ($stmt->execute()) {
        auditLog('device_revoked', $userId, ['device_uuid' => $deviceUuid]);
        echo json_encode(["status" => "success", "message" => "Device revoked"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to revoke device"]);
    }
}
