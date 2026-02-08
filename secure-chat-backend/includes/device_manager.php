<?php
// includes/device_manager.php
// Epic 47: Device Management Logic

require_once __DIR__ . '/db_connect.php';

function registerDevice($pdo, $userId, $deviceId, $platform, $name, $identityKey, $preKey)
{
    if (!in_array($platform, ['android', 'ios', 'web'])) {
        throw new Exception("INVALID_PLATFORM");
    }

    $fingerprint = hash('sha256', $identityKey);

    // Check if user has ANY trusted devices (First device auto-trust logic optional, but stricter is better)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM devices WHERE user_id = ? AND trust_state = 'TRUSTED' AND revoked_at IS NULL");
    $stmt->execute([$userId]);
    $trustedCount = $stmt->fetchColumn();

    // First device ever = TRUSTED, else PENDING
    $initialState = ($trustedCount == 0) ? 'TRUSTED' : 'PENDING';

    $stmt = $pdo->prepare("
        INSERT INTO devices 
        (device_id, user_id, platform, device_name, public_identity_key, public_pre_key, trust_state, fingerprint, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
            last_seen_at = NOW(),
            public_pre_key = VALUES(public_pre_key) -- Allow prekey rotation
    ");

    $stmt->execute([$deviceId, $userId, $platform, $name, $identityKey, $preKey, $initialState, $fingerprint]);

    return ['status' => $initialState, 'fingerprint' => $fingerprint];
}

function approveDevice($pdo, $approverUserId, $targetDeviceId)
{
    $stmt = $pdo->prepare("
        UPDATE devices 
        SET trust_state = 'TRUSTED' 
        WHERE device_id = ? AND user_id = ? AND trust_state = 'PENDING'
    ");
    $stmt->execute([$targetDeviceId, $approverUserId]);

    if ($stmt->rowCount() === 0) {
        throw new Exception("DEVICE_NOT_FOUND_OR_ALREADY_PROCESSED");
    }

    return true;
}

function revokeDevice($pdo, $userId, $targetDeviceId)
{
    // Prevent revoking the last trusted device (optional safety rail, but revocation is usually emergency)
    // For now, allow full revocation (Zero Trust)

    $stmt = $pdo->prepare("
        UPDATE devices 
        SET trust_state = 'REVOKED', revoked_at = NOW()
        WHERE device_id = ? AND user_id = ?
    ");
    $stmt->execute([$targetDeviceId, $userId]);

    return $stmt->rowCount() > 0;
}

function getTrustedDevices($pdo, $userId)
{
    $stmt = $pdo->prepare("
        SELECT device_id, platform, public_identity_key, public_pre_key 
        FROM devices 
        WHERE user_id = ? AND trust_state = 'TRUSTED' AND revoked_at IS NULL
    ");
    $stmt->execute([$userId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function checkPeerRelationship($pdo, $requesterId, $targetId)
{
    if ($requesterId === $targetId)
        return true;

    // Check 1: In contacts?
    // (Assuming contacts table exists, if not skip or mock)
    // $stmt = $pdo->prepare("SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?");
    // $stmt->execute([$requesterId, $targetId]);
    // if ($stmt->fetchColumn()) return true;

    // Check 2: Shared Group? (More robust)
    $stmt = $pdo->prepare("
        SELECT 1 FROM group_members gm1
        JOIN group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = ? AND gm2.user_id = ?
    ");
    $stmt->execute([$requesterId, $targetId]);
    if ($stmt->fetchColumn())
        return true;

    return false;
}
