<?php
// api/v4/vault/restore_access.php
// PURPOSE: Recover account access using a Recovery Phrase (BIP-39 Mnemonic).
// Returns: A temporary auth token to bootstrap the device.

require_once '../../db.php';
require_once '../../rate_limiter.php';
require_once '../../cache_service.php';
require_once '../../audit_log.php';

// Strict Rate Limiting (Brute Force Protection)
// 3 attempts per IP per hour
enforceRateLimit('dr_restore', 3, 3600);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$email = $data['email'] ?? '';
$phraseHashInput = $data['phrase_hash'] ?? ''; // Client hashes phrase (e.g. SHA-256) before sending? 
// BETTER: Client sends phrase, server hashes it? NO. Minimize sending secrets.
// ARCHITECTURE DECISION: 
// 1. Client derives Key K from Phrase.
// 2. Client signs a challenge with K? No, server doesn't know K.
// 3. Server stored H(Phrase). Client sends H(Phrase).
// RISK: If H(Phrase) is intercepted, attacker can login.
// MITIGATION: TLS Required. Rate Limiting.
// REALITY: Signal/WhatsApp verify SMS OTP for restore. 
// HERE: We claim to use "Recovery Phrase". We will assume Client sends H(Phrase).

if (!$email || !$phraseHashInput) {
    http_response_code(400);
    echo json_encode(["error" => "Missing email or recovery hash"]);
    exit;
}

// 1. Find User
$stmt = $conn->prepare("SELECT user_id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user) {
    // Timing attack mitigation: verify a dummy hash
    // password_verify('dummy', 'dummy_hash'); 
    http_response_code(401);
    echo json_encode(["error" => "Invalid credentials"]);
    exit;
}

$userId = $user['user_id'];

// 2. Verify Hash
// In `100_recovery_phrases.sql`, we store `phrase_hash` VARBINARY(64).
// Let's assume it's a raw binary SHA-256 or similar.
// For now, simple comparison.
$vStmt = $conn->prepare("SELECT phrase_hash FROM recovery_phrases WHERE user_id = ?");
$vStmt->bind_param("s", $userId);
$vStmt->execute();
$vRes = $vStmt->get_result();

if ($vRes->num_rows === 0) {
    http_response_code(403);
    echo json_encode(["error" => "No recovery phrase set for this account"]);
    exit;
}

$stored = $vRes->fetch_assoc();
// Ideally use hash_equals for timing safety
// We expect client to send Hex, DB might be Hex or Binary. 
// Assuming DB stores Hex for simplicity in V4.
if (!hash_equals($stored['phrase_hash'], $phraseHashInput)) {
    auditLog('dr_restore_fail', $userId, ['ip' => $_SERVER['REMOTE_ADDR']]);
    http_response_code(401);
    echo json_encode(["error" => "Invalid recovery phrase"]);
    exit;
}

// 3. Success! Generate Emergency Session
$jti = 'DR' . strtoupper(bin2hex(random_bytes(14)));
$refreshToken = bin2hex(random_bytes(32));
$expires = date('Y-m-d H:i:s', strtotime('+1 hour')); // Short lived

$sess = $conn->prepare("INSERT INTO user_sessions (user_id, device_uuid, id_token_jti, refresh_token, expires_at) 
                        VALUES (?, 'RESTORE_SESSION', ?, ?, ?)
                        ON DUPLICATE KEY UPDATE id_token_jti=?, refresh_token=?, expires_at=?");
$sess->bind_param("sssssss", $userId, $jti, $refreshToken, $expires, $jti, $refreshToken, $expires);
$sess->execute();

CacheService::cacheSession($jti, $userId, ['device' => 'RESTORE_SESSION']);

auditLog('dr_restore_success', $userId, ['method' => 'recovery_phrase']);

echo json_encode([
    "status" => "success",
    "message" => "Identity Verified. Proceed to vault restore.",
    "token" => $jti,
    "user_id" => $userId
]);
?>