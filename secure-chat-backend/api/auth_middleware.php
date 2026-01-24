<?php
/**
 * Authentication Middleware
 * Security Enhancement #3: JWT/Firebase Token Validation on all API requests
 */

require_once 'audit_log.php';

// List of endpoints that don't require authentication
$PUBLIC_ENDPOINTS = [
    '/api/register.php',
    '/api/profile.php', // Only confirm_otp action is public
];

/**
 * Validate Firebase ID Token
 * Note: For production, use Firebase Admin SDK or verify with Google's public keys
 * This is a simplified version that validates the token structure
 */
function validateFirebaseToken($token)
{
    if (empty($token)) {
        return null;
    }

    // Remove 'Bearer ' prefix if present
    if (str_starts_with($token, 'Bearer ')) {
        $token = substr($token, 7);
    }

    // JWT has 3 parts separated by dots
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    // Decode payload (middle part)
    $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);

    if (!$payload) {
        return null;
    }

    // Check expiration
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        return null; // Token expired
    }

    // Check issuer (Firebase project)
    // In production, verify this matches your Firebase project
    if (isset($payload['iss']) && !str_contains($payload['iss'], 'securetoken.google.com')) {
        return null;
    }

    // Return the user ID from the token
    return $payload['sub'] ?? $payload['user_id'] ?? null;
}

/**
 * Get the Authorization header
 */
function getAuthorizationHeader()
{
    $headers = null;

    if (isset($_SERVER['Authorization'])) {
        $headers = $_SERVER['Authorization'];
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(
            array_map('ucwords', array_keys($requestHeaders)),
            array_values($requestHeaders)
        );
        if (isset($requestHeaders['Authorization'])) {
            $headers = $requestHeaders['Authorization'];
        }
    }

    return $headers;
}

/**
 * Authenticate the request
 * Returns user ID if authenticated, null otherwise
 */
function authenticateRequest()
{
    $authHeader = getAuthorizationHeader();

    if (empty($authHeader)) {
        return null;
    }

    return validateFirebaseToken($authHeader);
}

/**
 * Require authentication - returns 401 if not authenticated
 * Can optionally verify the authenticated user matches the request user
 */
function requireAuth($requestUserId = null)
{
    $authUserId = authenticateRequest();

    if ($authUserId === null) {
        auditLog(AUDIT_AUTH_FAILED, null, ['reason' => 'missing_or_invalid_token']);
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized - Invalid or missing authentication token"]);
        exit;
    }

    // If a specific user ID is required, verify it matches
    if ($requestUserId !== null && $authUserId !== $requestUserId) {
        auditLog(AUDIT_AUTH_FAILED, $authUserId, [
            'reason' => 'user_mismatch',
            'requested_user' => $requestUserId
        ]);
        http_response_code(403);
        echo json_encode(["error" => "Forbidden - You can only access your own data"]);
        exit;
    }

    return $authUserId;
}

/**
 * Check if current endpoint is public (no auth required)
 */
function isPublicEndpoint()
{
    global $PUBLIC_ENDPOINTS;

    $currentPath = $_SERVER['REQUEST_URI'] ?? '';
    $currentPath = strtok($currentPath, '?'); // Remove query string

    foreach ($PUBLIC_ENDPOINTS as $endpoint) {
        if (str_ends_with($currentPath, basename($endpoint))) {
            return true;
        }
    }

    return false;
}
?>