<?php
/**
 * JWT Refresh Token Endpoint
 * Securely handles session renewal without re-authentication
 */
require 'db.php';
require_once 'auth_middleware.php';

$json = file_get_contents("php://input");
$data = json_decode($json);

// SECURITY FIX (Review 1.7): CSRF Protection
// Refresh Token endpoint relies on Cookies, so it MUST be protected against CSRF
validateCSRF();

// 0. Get Refresh Token from Cookie or Body
$refreshToken = $data->refresh_token ?? $_COOKIE['refresh_token'] ?? null;
$userId = sanitizeUserId($data->user_id);
$deviceUuid = $data->device_uuid ?? 'unknown';

if (!$refreshToken || !$userId) {
    http_response_code(400);
    echo json_encode(["error" => "Refresh token and user ID required"]);
    exit;
}

// 1. Validate Refresh Token in DB
// v2.3 Hardening: Check if the token matches CURRENT or if it was REUSED
$stmt = $conn->prepare("SELECT id_token_jti, rotation_family, is_revoked, refresh_token FROM user_sessions WHERE user_id = ? AND device_uuid = ? AND (refresh_token = ? OR last_refresh_token_hash = ?) AND expires_at > NOW()");
$rt_hash = hash('sha256', $refreshToken);
$stmt->bind_param("ssss", $userId, $deviceUuid, $refreshToken, $rt_hash);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) {
    // SECURITY ALERT: Refresh token not found at all
    auditLog(AUDIT_AUTH_FAILED, $userId, ['reason' => 'invalid_refresh_token', 'device' => $deviceUuid]);
    http_response_code(401);
    echo json_encode(["error" => "Session expired. Please log in again."]);
    exit;
}

$session = $res->fetch_assoc();

// REUSE DETECTION LOGIC (HF-7.1)
if ($session['is_revoked'] == 1) {
    http_response_code(403);
    echo json_encode(["error" => "SESSION_REVOKED", "details" => "This session family has been compromised."]);
    exit;
}

if ($session['refresh_token'] !== $refreshToken) {
    // REUSE DETECTED!
    // If the provided token matches last_refresh_token_hash but NOT current refresh_token, someone replayed an old token.
    $rotationFamily = $session['rotation_family'];
    $conn->query("UPDATE user_sessions SET is_revoked = 1, revoked_at = NOW() WHERE rotation_family = '$rotationFamily'");

    auditLog('TOKEN_REUSE_DETECTED', $userId, ['device_uuid' => $deviceUuid, 'family' => $rotationFamily]);

    http_response_code(403);
    echo json_encode(["error" => "FRAUD_DETECTED", "details" => "Security leak detected. All sessions for this device revoked."]);
    exit;
}

// 2. Clear old session cache
CacheService::delete("session:" . $session['id_token_jti']);

// 3. Issue New ID Token (JWT)
$newJti = 'U' . strtoupper(bin2hex(random_bytes(12)));
$newIdToken = $newJti;

// 4. Update Session in DB with ROTATION (HF-7.1)
$newExpires = date('Y-m-d H:i:s', strtotime('+24 hours'));
$newRefreshToken = bin2hex(random_bytes(32));
$newRtHash = hash('sha256', $refreshToken); // Current token becomes the "old" one
$rotationFamily = $session['rotation_family'] ?? bin2hex(random_bytes(16));

$upd = $conn->prepare("UPDATE user_sessions SET id_token_jti = ?, refresh_token = ?, last_refresh_token_hash = ?, rotation_family = ?, expires_at = ? WHERE user_id = ? AND device_uuid = ?");
$upd->bind_param("sssssss", $newJti, $newRefreshToken, $newRtHash, $rotationFamily, $newExpires, $userId, $deviceUuid);
$upd->execute();

// 5. Cache the new session
CacheService::cacheSession($newJti, $userId, ['device_uuid' => $deviceUuid]);

auditLog('REFRESH_TOKEN_ROTATED', $userId, ['device_uuid' => $deviceUuid, 'family' => $rotationFamily]);

// 6. Set HTTP-Only Cookies
$cookieExpires = strtotime($newExpires);
setcookie('auth_token', $newJti, [
    'expires' => $cookieExpires,
    'path' => '/api',
    'domain' => '',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict'
]);

$refreshExpires = time() + (86400 * 30); // 30 Days
setcookie('refresh_token', $newRefreshToken, [
    'expires' => $refreshExpires,
    'path' => '/api',
    'domain' => '',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict'
]);

echo json_encode([
    "status" => "success",
    "token" => $newIdToken,
    "refresh_token" => $newRefreshToken,
    "user_id" => $userId,
    "expires_at" => $newExpires,
    "rotation_family" => $rotationFamily
]);
?>