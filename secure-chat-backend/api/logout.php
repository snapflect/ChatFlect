<?php
/**
 * Logout Endpoint
 * Clears secure cookies and invalidates session
 */
require 'db.php';
require_once 'auth_middleware.php';

header('Content-Type: application/json');

// 1. Get Token (from Cookie or Header)
$token = $_COOKIE['auth_token'] ?? null;

if (!$token) {
    // Check header as fallback
    $authHeader = getAuthorizationHeader() ?: getXUserIdHeader();
    if ($authHeader) {
        if (stripos($authHeader, 'Bearer ') === 0) {
            $token = substr($authHeader, 7);
        } else {
            $token = $authHeader;
        }
    }
}

if ($token) {
    // 2. Invalidate Session in DB (Best Effort)
    // We assume token might be a JTI
    $stmt = $conn->prepare("DELETE FROM user_sessions WHERE id_token_jti = ?");
    $stmt->bind_param("s", $token);
    $stmt->execute();
}

// 3. Clear Cookies
setcookie('auth_token', '', time() - 3600, '/api');
setcookie('refresh_token', '', time() - 3600, '/api');

echo json_encode(["status" => "success", "message" => "Logged out"]);
?>