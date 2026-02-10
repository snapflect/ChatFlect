<?php
/**
 * OAuth Handler
 * Phase 1: Google OAuth 2.0 Sign-In
 * 
 * Verifies Google ID token and creates/links user account
 */
require 'db.php';
require_once 'rate_limiter.php';
require_once 'sanitizer.php';
require_once 'audit_log.php';

// Enforce rate limiting
enforceRateLimit();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON"]);
    exit;
}

$provider = sanitizeString($data['provider'] ?? '', 20);
$idToken = $data['id_token'] ?? null;
$email = sanitizeEmail($data['email'] ?? '');
$name = sanitizeString($data['name'] ?? '', 100);
$photoUrl = sanitizeUrl($data['photo_url'] ?? '');
$publicKey = $data['public_key'] ?? '';

if ($provider !== 'google') {
    http_response_code(400);
    echo json_encode(["error" => "Unsupported OAuth provider"]);
    exit;
}

if (!$idToken) {
    http_response_code(400);
    echo json_encode(["error" => "ID token required"]);
    exit;
}

// Verify Google ID Token
function verifyGoogleToken($idToken)
{
    $googleClientId = '1036135506512-1fj8d144k2i3k9aikpn34lu27ut1bhht.apps.googleusercontent.com';

    // Verify token with Google API
    $verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($idToken);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $verifyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return null;
    }

    $payload = json_decode($response, true);

    // Verify audience matches our client ID
    if (!$payload || $payload['aud'] !== $googleClientId) {
        return null;
    }

    // Check token expiry
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        return null;
    }

    return $payload;
}

$tokenPayload = verifyGoogleToken($idToken);

if (!$tokenPayload) {
    http_response_code(401);
    auditLog('oauth_invalid_token', null, ['provider' => $provider, 'email' => $email]);
    echo json_encode(["error" => "Invalid or expired token"]);
    exit;
}

// Extract verified email from token payload (more trustworthy)
$verifiedEmail = $tokenPayload['email'] ?? $email;
$googleSub = $tokenPayload['sub'] ?? null; // Google's unique user ID

if (!$verifiedEmail) {
    http_response_code(400);
    echo json_encode(["error" => "Email not found in token"]);
    exit;
}

// Generate unique user_id
function generateUserId()
{
    return 'U' . strtoupper(bin2hex(random_bytes(12)));
}

// Check if user exists by email
$stmt = $conn->prepare("SELECT user_id, is_profile_complete FROM users WHERE email = ?");
$stmt->bind_param("s", $verifiedEmail);
$stmt->execute();
$result = $stmt->get_result();
$existingUser = $result->fetch_assoc();
$stmt->close();

$isNewUser = false;
$isProfileComplete = 0;
$googleProfileData = json_encode($tokenPayload);

if ($existingUser) {
    // Existing user - update public key and profile data
    $userId = $existingUser['user_id'];
    $isProfileComplete = (int) $existingUser['is_profile_complete'];

    $updateStmt = $conn->prepare("UPDATE users SET public_key = ?, google_sub = ?, google_profile_data = ? WHERE user_id = ?");
    $updateStmt->bind_param("ssss", $publicKey, $googleSub, $googleProfileData, $userId);
    $updateStmt->execute();
    $updateStmt->close();

    auditLog('oauth_login', $userId, ['provider' => $provider, 'method' => 'existing']);
} else {
    // New user - create account
    $userId = generateUserId();
    $isNewUser = true;
    $isProfileComplete = 0; // Fresh Google users need phone registration

    // Extract first name from full name
    $firstName = explode(' ', $name)[0] ?? $name;
    $lastName = trim(str_replace($firstName, '', $name)) ?: null;

    $insertStmt = $conn->prepare("INSERT INTO users (user_id, email, first_name, last_name, photo_url, public_key, google_sub, google_profile_data, is_profile_complete, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $insertStmt->bind_param("ssssssssi", $userId, $verifiedEmail, $firstName, $lastName, $photoUrl, $publicKey, $googleSub, $googleProfileData, $isProfileComplete);

    if (!$insertStmt->execute()) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to create user: " . $insertStmt->error]);
        exit;
    }
    $insertStmt->close();

    auditLog('oauth_register', $userId, ['provider' => $provider, 'email' => $verifiedEmail]);
}

// 1. Create Session (Architectural Caching & Session Management)
$jti = 'U' . strtoupper(bin2hex(random_bytes(12)));
$refreshToken = bin2hex(random_bytes(32));
$deviceUuid = $data['device_uuid'] ?? 'unknown';
$expires = date('Y-m-d H:i:s', strtotime('+24 hours'));

$sess = $conn->prepare("INSERT INTO user_sessions (user_id, device_uuid, id_token_jti, refresh_token, expires_at) 
                        VALUES (?, ?, ?, ?, ?) 
                        ON DUPLICATE KEY UPDATE id_token_jti = ?, refresh_token = ?, expires_at = ?");
$sess->bind_param("ssssssss", $userId, $deviceUuid, $jti, $refreshToken, $expires, $jti, $refreshToken, $expires);
$sess->execute();
$sess->close();

// 2. Cache Session for instant auth
CacheService::cacheSession($jti, $userId, ['device' => $deviceUuid]);

// 3. Set HTTP-Only Cookies
$cookieExpires = strtotime($expires);
setcookie('auth_token', $jti, [
    'expires' => $cookieExpires,
    'path' => '/api',
    'domain' => '',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict'
]);

$refreshExpires = time() + (86400 * 30); // 30 Days
setcookie('refresh_token', $refreshToken, [
    'expires' => $refreshExpires,
    'path' => '/api',
    'domain' => '',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict'
]);

// Return success
echo json_encode([
    "status" => "success",
    "message" => $isNewUser ? "Account created" : "Login successful",
    "user_id" => $userId,
    "token" => $jti,
    "refresh_token" => $refreshToken,
    "is_new_user" => $isNewUser,
    "is_profile_complete" => $isProfileComplete
]);
?>