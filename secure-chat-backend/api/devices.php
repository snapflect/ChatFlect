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

// STRICT FIX: Schema should be managed via migrations only.
// See: secure-chat-backend/migrations/


$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);

    // REGISTER DEVICE
    if ($action === 'register') {
        $userId = isset($data['user_id']) ? trim(strtoupper($data['user_id'])) : ''; // v16.0 Zero-Trust Normalization
        $deviceUuid = $data['device_uuid'] ?? '';
        $publicKey = $data['public_key'] ?? ''; // Signal Identity Key
        $deviceName = $data['device_name'] ?? 'Mobile Device';
        $fcmToken = $data['fcm_token'] ?? null;
        $signingPubKey = $data['signing_public_key'] ?? null; // STRICT FIX (Epic 5): ECDSA Key

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

        // Determine Signal Device ID & Key Version
        $sigId = 1;
        $keyVersion = 1;

        // Check if device already exists to preserve ID and Version
        $existingParams = $conn->prepare("SELECT libsignal_device_id, key_version FROM user_devices WHERE user_id = ? AND device_uuid = ?");
        $existingParams->bind_param("ss", $userId, $deviceUuid);
        $existingParams->execute();
        $exRes = $existingParams->get_result();

        if ($exRes->num_rows > 0) {
            $row = $exRes->fetch_assoc();
            $sigId = (int) $row['libsignal_device_id'];
            $keyVersion = (int) $row['key_version']; // Preserve existing version
        } else {
            // New Device: Find max ID + 1
            $maxStmt = $conn->prepare("SELECT MAX(libsignal_device_id) as max_id FROM user_devices WHERE user_id = ?");
            $maxStmt->bind_param("s", $userId);
            $maxStmt->execute();
            $maxRes = $maxStmt->get_result()->fetch_assoc();
            $sigId = ($maxRes['max_id'] ?? 0) + 1;
            $keyVersion = 1; // Start at v1
            // Cap at 10? Signal allows more, but our logic limits to 5 devices anyway.
        }

        // Upsert device
        // Story 3.1: Include key_version in INSERT/UPDATE
        // Epic 5: Include signing_public_key
        $stmt = $conn->prepare("INSERT INTO user_devices (user_id, device_uuid, public_key, device_name, fcm_token, signature, bundle_version, signed_at, libsignal_device_id, key_version, signing_public_key, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
                                ON DUPLICATE KEY UPDATE public_key = ?, device_name = ?, fcm_token = ?, signature = ?, bundle_version = ?, signed_at = ?, libsignal_device_id = ?, key_version = ?, signing_public_key = ?, status = 'active', last_active = NOW()");

        if (!$stmt) {
            http_response_code(500);
            echo json_encode(["error" => "Database error: " . $conn->error]);
            exit;
        }

        // STRICT FIX: Correct bind_param count and types
        // INSERT: 11 params (status is hardcoded 'active')
        // UPDATE: 9 params (status is hardcoded 'active')
        $stmt->bind_param(
            "ssssssisiss" . "ssssisiss",

            // INSERT Values (11)
            $userId,
            $deviceUuid,
            $publicKey,
            $deviceName,
            $fcmToken,
            $signature,
            $bundleVersion, // i
            $timestamp,
            $sigId, // i
            $keyVersion, // i
            $signingPubKey,

            // UPDATE Values (9)
            $publicKey,
            $deviceName,
            $fcmToken,
            $signature,
            $bundleVersion, // i
            $timestamp,
            $sigId, // i
            $keyVersion, // i
            $signingPubKey
        );
        if ($stmt->execute()) {
            auditLog('device_registered', $userId, ['device_uuid' => $deviceUuid]);
            echo json_encode([
                "status" => "success",
                "message" => "Device registered",
                "libsignal_device_id" => $sigId,
                "key_version" => $keyVersion // Return version
            ]);
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

        $stmt = $conn->prepare("SELECT device_uuid, device_name, last_active, created_at, libsignal_device_id, status, revoked_at, signing_public_key FROM user_devices WHERE user_id = ?");
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
    $userId = $data['user_id'] ?? $_GET['user_id'] ?? '';
    $deviceUuid = $data['device_uuid'] ?? $_GET['device_uuid'] ?? '';
    $userId = trim(strtoupper($userId));

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
