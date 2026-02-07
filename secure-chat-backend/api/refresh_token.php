<?php
/**
 * JWT Refresh Token Endpoint
 * Securely handles session renewal without re-authentication
 */
require 'db.php';
require_once 'auth_middleware.php';

$json = file_get_contents("php://input");
$data = json_decode($json);

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
$stmt = $conn->prepare("SELECT id_token_jti FROM user_sessions WHERE user_id = ? AND device_uuid = ? AND refresh_token = ? AND expires_at > NOW()");
$stmt->bind_param("sss", $userId, $deviceUuid, $refreshToken);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) {
    // Clear cookies on failure
    setcookie('auth_token', '', time() - 3600, '/api');
    setcookie('refresh_token', '', time() - 3600, '/api');

    auditLog(AUDIT_AUTH_FAILED, $userId, ['reason' => 'invalid_refresh_token', 'device' => $deviceUuid]);
    http_response_code(401);
    echo json_encode(["error" => "Invalid or expired refresh token. Please log in again."]);
    exit;
}

// 2. Clear old session cache
$session = $res->fetch_assoc();
CacheService::delete("session:" . $session['id_token_jti']);

// 3. Issue New ID Token (JWT)
// Since we don't have a full JWT library yet, we'll use our existing U-based session IDs 
// or simulate a JWT structure that auth_middleware can parse.
$newJti = 'U' . strtoupper(bin2hex(random_bytes(12)));
$newIdToken = $newJti; // For this phase, the token IS the JTI

// 4. Update Session in DB with ROTATION (v8.1)
$newExpires = date('Y-m-d H:i:s', strtotime('+24 hours'));
$newRefreshToken = bin2hex(random_bytes(32)); // New refresh token rotation

$upd = $conn->prepare("UPDATE user_sessions SET id_token_jti = ?, refresh_token = ?, expires_at = ? WHERE user_id = ? AND device_uuid = ?");
$upd->bind_param("sssss", $newJti, $newRefreshToken, $newExpires, $userId, $deviceUuid);
$upd->execute();

// 5. Cache the new session for instant lookup
CacheService::cacheSession($newJti, $userId, ['device_uuid' => $deviceUuid]);

auditLog('REFRESH_TOKEN_ROTATED', $userId, ['device_uuid' => $deviceUuid]);

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
    "refresh_token" => $newRefreshToken,  // Return new refresh token to client
    "user_id" => $userId,
    "expires_at" => $newExpires
]);
?>