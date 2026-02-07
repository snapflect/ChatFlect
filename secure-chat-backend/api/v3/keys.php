<?php
// api/v3/keys.php
require_once '../auth_middleware.php'; // Include existing JWT auth & CORS
require_once '../db_connect.php';

// Allow CORS (Strict for Cookies)
$allowed = ['http://localhost:8100', 'http://localhost:4200', 'capacitor://localhost', 'http://localhost'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Authenticate User
$userId = requireAuth(); // Returns validated user_id from JWT
if (!$userId) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

// Main Router
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    handlePostKeys($userId, $conn);
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['count'])) {
        handleGetCount($userId, $conn);
    } else {
        handleGetKeys($userId, $conn);
    }
} else {
    http_response_code(405);
    echo json_encode(["error" => "Method Not Allowed"]);
}

/**
 * POST /v3/keys
 * Body: { identityKey, signedPreKey, oneTimePreKeys, deviceId, registrationId }
 */
function handlePostKeys($userId, $conn)
{
    $input = json_decode(file_get_contents("php://input"), true);

    // Validate Input
    if (!isset($input['deviceId'], $input['registrationId'], $input['identityKey'], $input['signedPreKey'])) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required fields"]);
        exit;
    }

    $deviceId = (int) $input['deviceId'];
    $regId = (int) $input['registrationId'];
    // Story 3.1: Handle Key Version (Default to 1 for Backward Compat)
    $keyVersion = isset($input['keyVersion']) ? (int) $input['keyVersion'] : 1;

    $identityKey = $input['identityKey'];
    $signedPreKey = $input['signedPreKey']; // { keyId, publicKey, signature }
    $otpks = $input['oneTimePreKeys'] ?? []; // Array of { keyId, publicKey }

    // Start Transaction
    $conn->begin_transaction();

    try {
        // 1. Verify Device Ownership (Strict)
        // Ensure user owns this device_uuid -> device_id mapping
        $devCheck = $conn->prepare("SELECT 1 FROM user_devices WHERE user_id = ? AND libsignal_device_id = ? AND is_active = 1");
        $devCheck->bind_param("si", $userId, $deviceId);
        $devCheck->execute();
        if ($devCheck->get_result()->num_rows === 0) {
            throw new Exception("Device Ownership Mismatch. User $userId does not own Device ID $deviceId.");
        }

        // Story 3.1: Sync key_version to user_devices (Ensure consistency)
        // We only update if the new version is greater or equal? 
        // For initial upload (register), it matches or sets. 
        $updDev = $conn->prepare("UPDATE user_devices SET key_version = ?, last_active = NOW() WHERE user_id = ? AND libsignal_device_id = ?");
        $updDev->bind_param("isi", $keyVersion, $userId, $deviceId);
        $updDev->execute();

        // 2. Identity Key Immutability Check
        // Check if an identity key exists for this user/device
        $stmt = $conn->prepare("SELECT public_key, registration_id FROM identity_keys WHERE user_id = ? AND device_id = ? FOR UPDATE");
        $stmt->bind_param("si", $userId, $deviceId);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($res->num_rows > 0) {
            $existing = $res->fetch_assoc();
            if ($existing['public_key'] !== $identityKey) {
                // CRIITICAL SECURITY EVENT: Identity Key Mismatch (Attempted Overwrite)
                // Reject unless explicit "force" flag (not implemented yet) or new regId?
                // Signal convention: If RegID differs, it might be a reinstall.
                if ($existing['registration_id'] != $regId) {
                    // Reinstall Scenario: Allow overwrite, but LOG heavily.
                    $auditChange = $conn->prepare("INSERT INTO prekey_audit_log (actor_user_id, target_user_id, target_device_id, action_type, ip_address, metadata) VALUES (?, ?, ?, 'IDENTITY_CHANGE', ?, ?)");
                    $meta = json_encode(["old_reg" => $existing['registration_id'], "new_reg" => $regId]);
                    $ip = $_SERVER['REMOTE_ADDR'];
                    $auditChange->bind_param("ssiss", $userId, $userId, $deviceId, $ip, $meta);
                    $auditChange->execute();

                    // Proceed to update (Overwrite)
                    $upd = $conn->prepare("UPDATE identity_keys SET public_key = ?, registration_id = ?, updated_at = NOW() WHERE user_id = ? AND device_id = ?");
                    $upd->bind_param("sisi", $identityKey, $regId, $userId, $deviceId);
                    $upd->execute();
                } else {
                    // Same RegID but diff Key? Malicious or Bug. Block.
                    throw new Exception("Identity Key Mismatch for same Registration ID. malicious?");
                }
            }
        } else {
            // New Registration
            $ins = $conn->prepare("INSERT INTO identity_keys (user_id, device_id, registration_id, public_key) VALUES (?, ?, ?, ?)");
            $ins->bind_param("siis", $userId, $deviceId, $regId, $identityKey);
            $ins->execute();
        }

        // 3. Store Signed PreKey
        // Mark old ones inactive
        $updSpk = $conn->prepare("UPDATE signed_pre_keys SET is_active = 0 WHERE user_id = ? AND device_id = ?");
        $updSpk->bind_param("si", $userId, $deviceId);
        $updSpk->execute();

        // Insert new one
        $insSpk = $conn->prepare("INSERT INTO signed_pre_keys (user_id, device_id, key_id, public_key, signature, is_active) VALUES (?, ?, ?, ?, ?, 1)");
        $insSpk->bind_param("siiss", $userId, $deviceId, $signedPreKey['keyId'], $signedPreKey['publicKey'], $signedPreKey['signature']);
        $insSpk->execute();

        // 4. Batch Insert One-Time PreKeys
        if (!empty($otpks)) {
            // Prepare statement once
            $insOtk = $conn->prepare("INSERT IGNORE INTO pre_keys (user_id, device_id, key_id, public_key) VALUES (?, ?, ?, ?)");
            foreach ($otpks as $k) {
                $insOtk->bind_param("siis", $userId, $deviceId, $k['keyId'], $k['publicKey']);
                $insOtk->execute();
            }
        }

        // 5. Audit Log (Upload)
        $audit = $conn->prepare("INSERT INTO prekey_audit_log (actor_user_id, target_user_id, target_device_id, action_type, ip_address) VALUES (?, ?, ?, 'UPLOAD_KEYS', ?)");
        $ip = $_SERVER['REMOTE_ADDR'];
        $audit->bind_param("ssis", $userId, $userId, $deviceId, $ip);
        $audit->execute();

        $conn->commit();
        echo json_encode(["status" => "success", "count_added" => count($otpks)]);

    } catch (Exception $e) {
        $conn->rollback();
        error_log("Upload Keys Failed: " . $e->getMessage());
        http_response_code(500); // Or 409 Conflict
        echo json_encode(["error" => "Key Upload Failed: " . $e->getMessage()]);
    }
}

/**
 * GET /v3/keys?userId={targetId}&deviceId={targetDevice}
 * returns: { identityKey, signedPreKey, preKey?, registrationId }
 */
function handleGetKeys($myUserId, $conn)
{
    if (!isset($_GET['userId'], $_GET['deviceId'])) {
        http_response_code(400);
        echo json_encode(["error" => "Missing userId or deviceId"]);
        exit;
    }

    $targetUserId = $_GET['userId'];
    $targetDeviceId = (int) $_GET['deviceId'];

    // Start Transaction (Critical for Atomic OTPK Claim)
    $conn->begin_transaction();

    try {
        // 1. Fetch Identity & Active Signed PreKey
        $stmt = $conn->prepare("
            SELECT 
                ik.public_key as identity_key, 
                ik.registration_id,
                spk.key_id as spk_id,
                spk.public_key as spk_key,
                spk.signature as spk_sig
            FROM identity_keys ik
            JOIN signed_pre_keys spk ON ik.user_id = spk.user_id AND ik.device_id = spk.device_id
            WHERE ik.user_id = ? AND ik.device_id = ? AND spk.is_active = 1
            LIMIT 1
        ");
        $stmt->bind_param("si", $targetUserId, $targetDeviceId);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($res->num_rows === 0) {
            throw new Exception("Target user/device not found or no active keys");
        }

        $bundle = $res->fetch_assoc();

        // 2. Claim One-Time PreKey (Atomic)
        // Strategy: Select ID of *one* available key FOR UPDATE, then Mark it consumed.
        $otpkQuery = $conn->prepare("
            SELECT id, key_id, public_key 
            FROM pre_keys 
            WHERE user_id = ? AND device_id = ? AND consumed_at IS NULL
            ORDER BY id ASC 
            LIMIT 1 
            FOR UPDATE SKIP LOCKED
        ");
        // atomic 'SKIP LOCKED' is best if supported (MySQL 8.0+), else standard FOR UPDATE works but blocks.
        // Fallback for older MySQL: Just FOR UPDATE.

        $otpkQuery->bind_param("si", $targetUserId, $targetDeviceId);
        $otpkQuery->execute();
        $otpkRes = $otpkQuery->get_result();

        $preKeyPart = null;
        if ($otpkRes->num_rows > 0) {
            $otpkRow = $otpkRes->fetch_assoc();

            // Mark Consumed
            $claim = $conn->prepare("UPDATE pre_keys SET consumed_at = NOW() WHERE id = ?");
            $claim->bind_param("i", $otpkRow['id']);
            $claim->execute();

            $preKeyPart = [
                "keyId" => (int) $otpkRow['key_id'],
                "publicKey" => $otpkRow['public_key']
            ];
        }

        // 3. Log Audit (Fetch)
        $audit = $conn->prepare("INSERT INTO prekey_audit_log (actor_user_id, target_user_id, target_device_id, action_type, ip_address) VALUES (?, ?, ?, 'FETCH_BUNDLE', ?)");
        $ip = $_SERVER['REMOTE_ADDR'];
        $audit->bind_param("ssis", $myUserId, $targetUserId, $targetDeviceId, $ip);
        $audit->execute();

        $conn->commit();

        // Construct Response
        $response = [
            "identityKey" => $bundle['identity_key'],
            "registrationId" => (int) $bundle['registration_id'],
            "signedPreKey" => [
                "keyId" => (int) $bundle['spk_id'],
                "publicKey" => $bundle['spk_key'],
                "signature" => $bundle['spk_sig']
            ],
            "preKey" => $preKeyPart // Nullable
        ];

        echo json_encode($response);

    } catch (Exception $e) {
        $conn->rollback();
        error_log("Fetch Bundle Failed: " . $e->getMessage());
        http_response_code(404);
        echo json_encode(["error" => "Key Bundle Fetch Failed"]);
    }
}

/**
 * GET /v3/keys?count=true
 * Returns count of available OTPKs for the authenticated device.
 */
function handleGetCount($userId, $conn)
{
    if (!isset($_GET['deviceId'])) {
        http_response_code(400);
        echo json_encode(["error" => "deviceId required"]);
        exit;
    }
    $deviceId = (int) $_GET['deviceId'];

    // Strict Ownership Check
    $devCheck = $conn->prepare("SELECT 1 FROM user_devices WHERE user_id = ? AND libsignal_device_id = ?");
    $devCheck->bind_param("si", $userId, $deviceId);
    $devCheck->execute();
    if ($devCheck->get_result()->num_rows === 0) {
        http_response_code(403);
        echo json_encode(["error" => "Access Denied to Device Keys"]);
        exit;
    }

    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM pre_keys WHERE user_id = ? AND device_id = ? AND consumed_at IS NULL");
    $stmt->bind_param("si", $userId, $deviceId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();

    echo json_encode(["count" => (int) $row['count']]);
}
?>