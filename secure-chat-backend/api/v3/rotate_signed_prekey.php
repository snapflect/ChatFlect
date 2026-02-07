<?php
// api/v3/rotate_signed_prekey.php
require_once '../auth_middleware.php';
require_once '../db_connect.php';
require_once '../CryptoUtils.php';

// Allow CORS
$allowed = ['http://localhost:8100', 'http://localhost:4200', 'capacitor://localhost', 'http://localhost'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Signal-Signature");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Authenticate
$userId = requireAuth();
if (!$userId) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // STRICT FIX: Capture Raw Body for Signature Verification
    $rawBody = file_get_contents("php://input");
    $input = json_decode($rawBody, true);

    // Validate Input
    if (!isset($input['deviceId'], $input['keyVersion'], $input['signedPreKey'])) {
        http_response_code(400);
        echo json_encode(["error" => "Missing fields"]);
        exit;
    }

    $deviceId = (int) $input['deviceId'];
    $newVersion = (int) $input['keyVersion'];
    $signedPreKey = $input['signedPreKey']; // { keyId, publicKey, signature }

    if (!isset($signedPreKey['keyId'], $signedPreKey['publicKey'], $signedPreKey['signature'])) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid SignedPreKey format"]);
        exit;
    }

    $conn->begin_transaction();

    try {
        // 1. Verify Device Ownership & Current Version
        $stmt = $conn->prepare("SELECT key_version, libsignal_device_id FROM user_devices WHERE user_id = ? AND libsignal_device_id = ? FOR UPDATE");
        $stmt->bind_param("si", $userId, $deviceId);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($res->num_rows === 0) {
            throw new Exception("Device not found or not owned by user.");
        }

        $deviceRow = $res->fetch_assoc();
        $currentVersion = (int) $deviceRow['key_version'];
        $lastRotatedAt = $deviceRow['rotated_at']; // Fetch previous rotation time

        // --- STORY 3.3: Strict Cooldown Enforcement ---
        if ($lastRotatedAt) {
            $lastTs = strtotime($lastRotatedAt);
            $nowTs = time();
            $diff = $nowTs - $lastTs;
            $cooldown = 7 * 24 * 60 * 60; // 7 days

            if ($diff < $cooldown) {
                // Optional: Log attempt?
                throw new Exception("Rotation cooldown active. Try again later.");
            }
        }

        // 2. Strict Version Check (Prevent Replay/Downgrade)
        // STRICT: Must be exactly current + 1
        if ($newVersion !== $currentVersion + 1) {
            throw new Exception("Invalid key version. Expected " . ($currentVersion + 1) . ", got $newVersion.");
        }

        // 3. Fetch Identity Key for Verification
        $idStmt = $conn->prepare("SELECT public_key FROM identity_keys WHERE user_id = ? AND device_id = ?");
        $idStmt->bind_param("si", $userId, $deviceId);
        $idStmt->execute();
        $idRes = $idStmt->get_result();

        if ($idRes->num_rows === 0) {
            throw new Exception("No Identity Key found for this device. Cannot verify signature.");
        }

        $identityKeyRows = $idRes->fetch_assoc();
        $identityKeyBase64 = $identityKeyRows['public_key'];

        // --- SECURITY FIX (3): Validate Request Body Signature (MITM Protection) ---
        // Header: X-Signal-Signature
        // Signed Payload: Raw JSON Body
        // Verifier: Identity Key
        $reqSignature = $_SERVER['HTTP_X_SIGNAL_SIGNATURE'] ?? '';
        if (!$reqSignature) {
            throw new Exception("Missing X-Signal-Signature header.");
        }

        // Verify Request Signature (Use RAW verification)
        if (!CryptoUtils::verifySignalSignatureRaw($identityKeyBase64, $rawBody, $reqSignature)) {
            throw new Exception("Request Tampering Detected. Invalid Body Signature.|ROTATE_MITM_FAIL");
        }

        // 4. Verify SignedPreKey Signature (STRICT SECURITY)
        // LibSignal Signature: Ed25519(IdentityPriv, PublicSignedPreKey)
        // Validated by: Ed25519Verify(IdentityPub, PublicSignedPreKey, Signature)
        // Note: In PHP, we use Sodium if available, or a polyfill.
        // Assuming CryptoUtils::verifySignature($pubKey, $msg, $signature) exists.
        // The message signed is likely the Public Key bytes.

        // This validation is complex in strict PHP without libsignal.
        // For MVP/Story 3.2, we will assume the client is honest BUT we should verify if possible.
        // If we cannot verify easily in PHP without a library, we might skip strictly cryptographic verification
        // HERE but enforce strict ownership.
        // User Requirement: "signature verified using stored IdentityKey (correct Signal model)"
        // We will delegate to CryptoUtils.

        if (!CryptoUtils::verifySignalSignature($identityKeyBase64, $signedPreKey['publicKey'], $signedPreKey['signature'])) {
            throw new Exception("Invalid SignedPreKey signature. Verification failed.|ROTATE_SIG_FAIL");
        }

        // 5. Update Signed PreKey Table
        // Upsert? Or just Insert new? Signal typically keeps latest.
        // We'll replace/upsert for this keyId.
        $spkId = (int) $signedPreKey['keyId'];
        $spkPub = $signedPreKey['publicKey'];
        $spkSig = $signedPreKey['signature'];

        // Add proper columns if needed (assuming `signed_pre_keys` table exists from Story 2.4/2.5)
        $updKey = $conn->prepare("INSERT INTO signed_pre_keys (user_id, device_id, key_id, public_key, signature, created_at) VALUES (?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE public_key = ?, signature = ?, created_at = NOW()");
        $updKey->bind_param("siissss", $userId, $deviceId, $spkId, $spkPub, $spkSig, $spkPub, $spkSig);
        $updKey->execute();

        // 6. Update Device Version & Rotation Time
        $updDevice = $conn->prepare("UPDATE user_devices SET key_version = ?, rotated_at = NOW(), last_active = NOW() WHERE user_id = ? AND libsignal_device_id = ?");
        $updDevice->bind_param("isi", $newVersion, $userId, $deviceId);
        $updDevice->execute();

        // Fetch strict timestamp to return
        $tsStmt = $conn->prepare("SELECT rotated_at FROM user_devices WHERE user_id = ? AND libsignal_device_id = ?");
        $tsStmt->bind_param("si", $userId, $deviceId);
        $tsStmt->execute();
        $tsRes = $tsStmt->get_result()->fetch_assoc();

        // 7. Success
        $conn->commit();

        // AUDIT LOG: SUCCESS (After Commit)
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
        $auditSpec = $conn->prepare("INSERT INTO signed_prekey_rotations (user_id, device_id, old_key_version, new_key_version, signed_prekey_id, rotated_at, ip_address, user_agent, event_type) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, 'ROTATE_SUCCESS')");
        $auditSpec->bind_param("siiiiss", $userId, $deviceId, $currentVersion, $newVersion, $spkId, $ip, $ua);
        $auditSpec->execute();

        echo json_encode([
            "status" => "success",
            "new_version" => $newVersion,
            "rotated_at" => $tsRes['rotated_at']
        ]);

    } catch (Exception $e) {
        $conn->rollback(); // Rollback main transaction FIRST

        // Extract Audit Event from Exception message if present "Message|EVENT_NAME"
        $parts = explode('|', $e->getMessage());
        $msg = $parts[0];
        $event = $parts[1] ?? 'ROTATE_FAIL'; // Default fail type

        // AUDIT LOG: FAILURE (Persisted after rollback)
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;

        // Use default values if variables not set yet
        $auditUserId = $userId ?? 'unknown';
        $auditDeviceId = $deviceId ?? 0;
        $auditOldVer = $currentVersion ?? 0;
        $auditNewVer = $newVersion ?? 0;
        $auditKeyId = 0; // Unknown on generic fail

        // Safe Insert
        try {
            $audit = $conn->prepare("INSERT INTO signed_prekey_rotations (user_id, device_id, old_key_version, new_key_version, signed_prekey_id, rotated_at, ip_address, user_agent, event_type) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)");
            $audit->bind_param("siiiisss", $auditUserId, $auditDeviceId, $auditOldVer, $auditNewVer, $auditKeyId, $ip, $ua, $event);
            $audit->execute();
        } catch (Exception $logEx) {
            error_log("Audit Log Failed: " . $logEx->getMessage());
        }

        http_response_code(400);
        echo json_encode(["error" => $msg]);
    }

}