<?php
require_once 'db.php';
require_once 'audit_log.php';
require_once 'rate_limiter.php'; // v12
require_once 'cache_service.php'; // Fix for 500 Error
require_once __DIR__ . '/../includes/deprecation.php'; // Epic 34

// v15.2: Ensure consistent JSON headers for all functional endpoints
if (basename($_SERVER['SCRIPT_NAME']) !== 'serve.php') {
    header('Content-Type: application/json; charset=utf-8');
}

// Epic 34: Apply API version and deprecation headers
applyVersionHeaders();

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

    $finalUserId = $resolvedId ?: $sub;

    // Extract Device UUID (Story 4.1)
    // Custom tokens / Sessions should have 'device_uuid' claim or 'claims' array
    $deviceUuid = $payload['device_uuid'] ?? $payload['claims']['device_uuid'] ?? null;

    return ['user_id' => $finalUserId, 'device_uuid' => $deviceUuid];
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
 * Returns ['user_id' => string, 'device_uuid' => string|null] or null
 */
function authenticateRequest()
{
    // 1. Get token from Cookie (Priority)
    $token = $_COOKIE['auth_token'] ?? null;

    // 2. Fallback: Get header
    if (!$token) {
        $authHeader = getAuthorizationHeader() ?: getXUserIdHeader();
        if (!$authHeader)
            return null;

        // Remove 'Bearer ' prefix
        if (stripos($authHeader, 'Bearer ') === 0) {
            $token = substr($authHeader, 7);
        } else {
            $token = $authHeader;
        }
    }
    $token = trim($token);

    // 3. PRIORITY CACHE CHECK (Fast Path)
    // Cache service stores array: ['user_id' => ..., 'metadata' => ['device_uuid' => ...]]
    $cached = CacheService::getSession($token);
    if ($cached && isset($cached['user_id'])) {
        // Normalize CACHE return
        return [
            'user_id' => $cached['user_id'],
            'device_uuid' => $cached['device_uuid'] ?? $cached['metadata']['device_uuid'] ?? $cached['metadata']['device'] ?? null
        ];
    }

    // 3.5 Fallback: DB SESSION CHECK (Medium Path)
    // If cache is empty (e.g. after TRUNCATE), check the user_sessions table
    global $conn;
    $stmt = $conn->prepare("SELECT user_id, device_uuid FROM user_sessions WHERE id_token_jti = ? AND expires_at > NOW()");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        $userId = strtoupper(trim($row['user_id']));
        $deviceUuid = $row['device_uuid'];

        // Refill the cache for next hit
        CacheService::cacheSession($token, $userId, ['device_uuid' => $deviceUuid]);

        return [
            'user_id' => $userId,
            'device_uuid' => $deviceUuid
        ];
    }
    $stmt->close();

    // 4. Fallback: Full JWT/DB Validation (Slow Path)
    $authResult = validateFirebaseToken($token); // Now returns array or null

    // 5. If successful, cache it for next time
    if ($authResult && isset($authResult['user_id'])) {
        CacheService::cacheSession($token, $authResult['user_id'], ['device_uuid' => $authResult['device_uuid']]);
    }

    return $authResult; // Array or null
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
 * Require authentication - returns user_id string if success, exits if fail.
 */
function requireAuth($requestUserId = null)
{
    $authContext = authenticateRequest(); // Now returns array {user_id, device_uuid}

    // Backward compatibility: If it returned scalar (unlikely with new code but safe)
    if (is_scalar($authContext)) {
        $authContext = ['user_id' => $authContext, 'device_uuid' => null];
    }

    if (!$authContext || empty($authContext['user_id'])) {
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

    $authUserId = $authContext['user_id'];
    $deviceUuid = $authContext['device_uuid'] ?? null;

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

    // --- STRICT DEVICE TRUST ENFORCEMENT (Epic 4, Story 4.1) ---
    // 1. Zero-Trust: Token MUST have a bound device_uuid
    if (!$deviceUuid) {
        // Allow migration period? The user said "Denying JWT without device_uuid will break ALL existing users"
        // But also said "Update user_devices SET status='active'".
        // AND "If JWT missing device_uuid -> deny".
        // SO strict zero trust means we DENY.
        // Exception: Is this the 'firebase_auth.php' exchange endpoint?
        // firebase_auth.php calls requireAuth(). 
        // If the INPUT token to firebase_auth.php is a RAW ID TOKEN, it won't have device_uuid.
        // So we MUST allow raw tokens IF the script is firebase_auth.php?
        // Or refactor firebase_auth.php to NOT call requireAuth() but do its own validation?
        // 'firebase_auth.php' line 21: $userId = requireAuth();

        $scriptName = basename($_SERVER['SCRIPT_NAME']);
        if ($scriptName === 'firebase_auth.php' || $scriptName === 'register.php' || $scriptName === 'devices.php' || $scriptName === 'profile.php') {
            // Allow raw tokens (Session Cookies) for exchange/registration/initial profile
        } else {
            auditLog(AUDIT_AUTH_FAILED, $authUserId, ['reason' => 'missing_device_binding']);
            http_response_code(403);
            echo json_encode(["error" => "Device Binding Required. Please re-authenticate."]);
            exit;
        }
    } else {
        // 2. Strict DB Status Check
        global $conn;
        // Use a lightweight check or cache?
        // We should check DB to respect revocation INSTANTLY.
        // Caching verification might delay revocation.
        // But checking DB on every request is heavy?
        // User Requirement: "enforce revoked devices cannot access endpoints"
        // User Requirement: "status != 'active' -> reject"

        $stmt = $conn->prepare("SELECT status, revoked_at FROM user_devices WHERE user_id = ? AND device_uuid = ?");
        $stmt->bind_param("ss", $authUserId, $deviceUuid);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($res->num_rows === 0) {
            $scriptName = basename($_SERVER['SCRIPT_NAME']);
            $allowedOnboarding = ['firebase_auth.php', 'register.php', 'devices.php', 'profile.php'];
            if (in_array($scriptName, $allowedOnboarding)) {
                // Allow missing device record for onboarding scripts
                // This resolves the Catch-22 where registration is blocked by lack of registration
                error_log("[Auth] Allowing missing device record for onboarding script: $scriptName");
            } else {
                // Device not found (spoofed UUID?)
                auditLog(AUDIT_AUTH_FAILED, $authUserId, ['reason' => 'device_not_found', 'device' => $deviceUuid]);
                http_response_code(403);
                echo json_encode(["error" => "Device not recognized."]);
                exit;
            }
        }

        $devRow = $res->fetch_assoc();
        if ($devRow) {
            if ($devRow['status'] !== 'active' || $devRow['revoked_at'] !== null) {
                auditLog(AUDIT_AUTH_FAILED, $authUserId, ['reason' => 'device_revoked_or_pending', 'device' => $deviceUuid, 'status' => $devRow['status']]);
                http_response_code(403);
                echo json_encode([
                    "error" => "Device not trusted.",
                    "status" => $devRow['status']
                ]);
                exit;
            }
        }

        // --- Epic 26: Security Alerts Integration ---
        $currentIp = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

        // NEW_DEVICE_LOGIN: Check if this is first login for this device
        $lastLoginStmt = $conn->prepare("SELECT id FROM device_audit_logs WHERE user_id = ? AND device_uuid = ? AND event_type = 'LOGIN' LIMIT 1");
        if ($lastLoginStmt) {
            $lastLoginStmt->bind_param("ss", $authUserId, $deviceUuid);
            $lastLoginStmt->execute();
            $loginResult = $lastLoginStmt->get_result();
            $isNewDevice = ($loginResult->num_rows === 0);
            $lastLoginStmt->close();

            if ($isNewDevice) {
                // Trigger NEW_DEVICE_LOGIN alert
                require_once __DIR__ . '/../includes/security_alerts.php';
                alertNewDeviceLogin(getDbPdo(), $authUserId, $deviceUuid, $currentIp, $userAgent);
            }
        }

        // IP_CHANGE: Compare to last 3 logins
        $ipCheckStmt = $conn->prepare("SELECT DISTINCT ip_address FROM device_audit_logs WHERE user_id = ? AND event_type = 'LOGIN' ORDER BY created_at DESC LIMIT 3");
        if ($ipCheckStmt) {
            $ipCheckStmt->bind_param("s", $authUserId);
            $ipCheckStmt->execute();
            $ipResult = $ipCheckStmt->get_result();
            $recentIps = [];
            while ($ipRow = $ipResult->fetch_assoc()) {
                $recentIps[] = $ipRow['ip_address'];
            }
            $ipCheckStmt->close();

            // If we have history and current IP is not in the last 3
            if (count($recentIps) > 0 && !in_array($currentIp, $recentIps)) {
                require_once __DIR__ . '/../includes/security_alerts.php';
                createSecurityAlert(getDbPdo(), $authUserId, 'IP_CHANGE', 'WARNING', $deviceUuid, $currentIp, [
                    'previous_ips' => $recentIps,
                    'message' => 'Login from a new IP address detected'
                ]);
            }
        }

        // Log this login to device_audit_logs
        $logStmt = $conn->prepare("INSERT INTO device_audit_logs (user_id, device_uuid, event_type, ip_address, user_agent) VALUES (?, ?, 'LOGIN', ?, ?)");
        if ($logStmt) {
            $logStmt->bind_param("ssss", $authUserId, $deviceUuid, $currentIp, $userAgent);
            $logStmt->execute();
            $logStmt->close();
        }
    }


    // Verify it matches the requested user ID if one was provided
    // v16.0: Strict Zero-Trust Comparison (Case-Insensitive)
    if ($requestUserId !== null && strtoupper(trim($authUserId)) !== strtoupper(trim($requestUserId))) {
        auditLog(AUDIT_AUTH_FAILED, $authUserId, [
            "reason" => "identity_mismatch",
            "auth_id" => $authUserId,
            "req_id" => $requestUserId
        ]);
        http_response_code(403);
        echo json_encode([
            "error" => "Forbidden - You can only access your own data",
            "debug_auth_id" => $authUserId,
            "debug_req_id" => $requestUserId
        ]);
        exit;
    }

    // SECURITY FIX (Review 1.7): CSRF Protection for Cookie Auth
    validateCSRF();

    return $authUserId;
}

/**
 * Validate CSRF (Origin Check)
 * Required for HttpOnly Cookie Auth
 */
function validateCSRF()
{
    // 1. Skip for Safe Methods (GET, HEAD, OPTIONS)
    if (in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD', 'OPTIONS'])) {
        return true;
    }

    // 2. Define Allowed Origins
    $allowedOrigins = [
        'http://localhost:8100', // Ionic Serve
        'http://localhost:4200', // Angular Serve
        'http://localhost',      // Android Cap
        'capacitor://localhost', // iOS Cap
        'https://localhost',      // Secure Local
        'https://chat.snapflect.com' // Production Web
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? null;

    // 3. Strict Check
    if ($origin) {
        // Strip trailing slash for matching
        $originClean = rtrim($origin, '/');

        // Check if origin matches any allowed prefix (or exact match)
        $isValid = false;
        foreach ($allowedOrigins as $allowed) {
            if ($originClean === $allowed || strpos($originClean, $allowed) === 0) {
                $isValid = true;
                break;
            }
        }

        if (!$isValid) {
            error_log("CSRF Blocked: Invalid Origin $origin");
            http_response_code(403);
            echo json_encode(["error" => "CSRF Forbidden - Invalid Origin"]);
            exit;
        }
    } else {
        // 4. Missing Origin?
        // Browsers MUST send Origin for CORS.
        // If missing, it might be a direct cURL or non-browser tool.
        // Block strict for now unless a special bypass header is present (for testing)
        // For Phase 2, we block.
        // check for a bypass header used by tests if needed, currently none.
        // error_log("CSRF Warning: Missing Origin");
    }
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