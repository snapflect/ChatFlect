<?php
require_once 'db.php';
require_once 'audit_log.php';
require_once 'rate_limiter.php'; // v12

// v15.2: Ensure consistent JSON headers for all functional endpoints
if (basename($_SERVER['SCRIPT_NAME']) !== 'serve.php') {
    header('Content-Type: application/json; charset=utf-8');
}

/**
 * Authentication Middleware
 * Security Enhancement #3: JWT/Firebase Token Validation on all API requests
 */

// List of endpoints that don't require authentication
$PUBLIC_ENDPOINTS = [
    '/api/register.php',
    '/api/profile.php', // Only confirm_otp action is public
];

/**
 * Validate Firebase ID Token
 */
function validateFirebaseToken($token)
{
    if (empty($token)) {
        return null;
    }

    // Remove 'Bearer ' prefix (case-insensitive)
    if (stripos($token, 'Bearer ') === 0) {
        $token = substr($token, 7);
    }
    $token = trim($token);

    if (empty($token)) {
        return null;
    }

    // Pattern for local user IDs (fallback)
    $isLocalPattern = preg_match('/^U[0-9A-F]{24}$/', $token) || preg_match('/^user_/', $token);

    // JWT has 3 parts separated by dots
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return $isLocalPattern ? $token : null;
    }

    // Decode payload (middle part)
    $payloadJson = base64_decode(strtr($parts[1], '-_', '+/'));
    if (!$payloadJson) {
        return $isLocalPattern ? $token : null;
    }

    $payload = json_decode($payloadJson, true);
    if (!$payload) {
        return $isLocalPattern ? $token : null;
    }

    // Check expiration
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        error_log("Token expired for sub: " . ($payload['sub'] ?? 'unknown'));
        return null; // Expired JWTs should be refreshed
    }

    // Check issuer (Firebase project or Google)
    $allowedIssuers = ['securetoken.google.com', 'accounts.google.com'];
    $isValidIss = false;
    foreach ($allowedIssuers as $iss) {
        // Use strpos for PHP 7 compatibility
        if (isset($payload['iss']) && strpos($payload['iss'], $iss) !== false) {
            $isValidIss = true;
            break;
        }
    }

    if (!$isValidIss) {
        return $isLocalPattern ? $token : null;
    }

    // Return the user ID from the token
    $sub = $payload['sub'] ?? $payload['user_id'] ?? null;
    if (!$sub)
        return null;

    // Resolve Google sub to local user_id
    global $conn;
    $stmt = $conn->prepare("SELECT user_id FROM users WHERE google_sub = ?");
    $stmt->bind_param("s", $sub);
    $stmt->execute();
    $res = $stmt->get_result();
    $resolvedId = null;
    if ($row = $res->fetch_assoc()) {
        $resolvedId = $row['user_id'];
    }
    $stmt->close();

    return $resolvedId ?: $sub;
}

/**
 * Get the Authorization header from various sources
 */
function getAuthorizationHeader()
{
    if (isset($_SERVER['Authorization'])) {
        return $_SERVER['Authorization'];
    }
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            return $headers['Authorization'];
        }
        if (isset($headers['authorization'])) {
            return $headers['authorization'];
        }
    }
    return null;
}

/**
 * Get the X-User-ID header (Fallback)
 */
function getXUserIdHeader()
{
    if (isset($_SERVER['HTTP_X_USER_ID'])) {
        return $_SERVER['HTTP_X_USER_ID'];
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['X-User-ID'])) {
            return $headers['X-User-ID'];
        }
        if (isset($headers['x-user-id'])) {
            return $headers['x-user-id'];
        }
    }
    return null;
}

/**
 * Authenticate the request
 */
function authenticateRequest()
{
    // 1. Get header
    $authHeader = getAuthorizationHeader() ?: getXUserIdHeader();
    if (!$authHeader)
        return null;

    // 2. Remove 'Bearer ' prefix
    if (stripos($authHeader, 'Bearer ') === 0) {
        $token = substr($authHeader, 7);
    } else {
        $token = $authHeader;
    }
    $token = trim($token);

    // 3. PRIORITY CACHE CHECK (Fast Path)
    $cached = CacheService::getSession($token);
    if ($cached && isset($cached['user_id'])) {
        return $cached['user_id'];
    }

    // 4. Fallback: Full JWT/DB Validation (Slow Path)
    $userId = validateFirebaseToken($token);

    // 5. If successful, cache it for next time
    if ($userId) {
        CacheService::cacheSession($token, $userId);
    }

    return $userId;
}

/**
 * Check if the user is blocked (v8.1)
 * Uses lightweight caching to prevent DB hammer while maintaining security.
 */
function isUserBlocked($userId)
{
    if (!$userId)
        return false;

    // Check Cache (5 min TTL for block status)
    $cachedStatus = CacheService::get("user_blocked:$userId");
    if ($cachedStatus !== null)
        return (bool) $cachedStatus;

    global $conn;
    $stmt = $conn->prepare("SELECT is_blocked FROM users WHERE user_id = ?");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $isBlocked = false;
    if ($row = $res->fetch_assoc()) {
        $isBlocked = (int) $row['is_blocked'] === 1;
    }
    $stmt->close();

    // Cache the status for 5 minutes
    CacheService::set("user_blocked:$userId", $isBlocked ? 1 : 0, 300);

    return $isBlocked;
}

/**
 * Require authentication - returns 401 if not authenticated
 */
function requireAuth($requestUserId = null)
{
    $authUserId = authenticateRequest();

    if ($authUserId === null) {
        $authHeader = getAuthorizationHeader();
        $xUserId = getXUserIdHeader();
        $debugInfo = [
            "error" => "Unauthorized - Invalid or missing authentication token",
            "debug_ref" => time(),
            "auth_chars" => $authHeader ? strlen($authHeader) : 0,
            "xid_chars" => $xUserId ? strlen($xUserId) : 0
        ];

        // Enforce IP limit even for failed auth to prevent brute force
        enforceRateLimit(null);

        auditLog(AUDIT_AUTH_FAILED, null, ['reason' => 'missing_or_invalid_token', 'debug' => $debugInfo]);
        http_response_code(401);
        echo json_encode($debugInfo);
        exit;
    }

    // v12: Enforce Rate Limit (Prioritized User > Device > IP)
    enforceRateLimit($authUserId);

    // --- Server-Side Block Enforcement (v8.1) ---
    if (isUserBlocked($authUserId)) {
        auditLog(AUDIT_AUTH_FAILED, $authUserId, ['reason' => 'account_blocked']);
        http_response_code(403);
        echo json_encode([
            "error" => "Account Blocked - Please contact support.",
            "status" => "blocked"
        ]);
        exit;
    }

    // Verify it matches the requested user ID if one was provided
    if ($requestUserId !== null && $authUserId !== $requestUserId) {
        auditLog(AUDIT_AUTH_FAILED, $authUserId, [
            'reason' => 'user_mismatch',
            'requested_user' => $requestUserId,
            'authenticated_user' => $authUserId
        ]);
        http_response_code(403);
        echo json_encode([
            "error" => "Forbidden - You can only access your own data",
            "auth_id" => $authUserId,
            "req_id" => $requestUserId
        ]);
        exit;
    }

    return $authUserId;
}

/**
 * Check if current endpoint is public
 */
function isPublicEndpoint()
{
    $currentPath = $_SERVER['REQUEST_URI'] ?? '';
    $currentPath = strtok($currentPath, '?');

    global $PUBLIC_ENDPOINTS;
    foreach ($PUBLIC_ENDPOINTS as $endpoint) {
        if (str_ends_with($currentPath, basename($endpoint))) {
            return true;
        }
    }
    return false;
}
?>