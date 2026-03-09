<?php
/**
 * api/contacts/map.php
 * Secure Contact Mapping (v3.0 Production)
 * Privacy-First: Server never sees phone numbers, only SHA-256(Salt + Number).
 */

require_once '../db.php';
require_once '../auth_middleware.php';
require_once '../rate_limiter.php';

// HF-4.2: Enforce strict rate limit for contact mapping
enforceRateLimit(null, 50, 3600);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method Not Allowed"]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);
$hashes = $input['hashes'] ?? [];
$deviceUuid = $input['device_uuid'] ?? '';
$nonce = $input['nonce'] ?? '';
$timestamp = $input['timestamp'] ?? 0;

if (!is_array($hashes) || empty($hashes)) {
    echo json_encode(["success" => true, "matches" => []]);
    exit;
}

// Cap batch size
if (count($hashes) > 200) {
    $hashes = array_slice($hashes, 0, 200);
}

// HF-4.3: Simple Replay Protection (Time Window)
$now = time() * 1000;
if (abs($now - $timestamp) > 300000) { // 5 minute window
    http_response_code(403);
    echo json_encode(["error" => "REPLAY_DETECTED", "details" => "Clock skew too high"]);
    exit;
}

// Validate hashes are proper SHA-256 hex strings
$validHashes = [];
foreach ($hashes as $h) {
    if (is_string($h) && preg_match('/^[a-f0-9]{64}$/', $h)) {
        $validHashes[] = $h;
    }
}

if (empty($validHashes)) {
    echo json_encode(["success" => true, "matches" => []]);
    exit;
}

// Match by phone_hash column (indexed)
$placeholders = implode(',', array_fill(0, count($validHashes), '?'));
$sql = "SELECT user_id, phone_hash, first_name, last_name, photo_url, short_note 
        FROM users 
        WHERE phone_hash IN ($placeholders)";

$stmt = $conn->prepare($sql);
$stmt->bind_param(str_repeat('s', count($validHashes)), ...$validHashes);
$stmt->execute();
$result = $stmt->get_result();

$matches = [];
while ($row = $result->fetch_assoc()) {
    // Build photo URL
    $photoUrl = null;
    if (!empty($row['photo_url'])) {
        if (strpos($row['photo_url'], 'http') === 0) {
            $photoUrl = $row['photo_url'];
        } else {
            $photoUrl = 'serve.php?file=' . ltrim($row['photo_url'], '/');
        }
    }

    $matches[] = [
        "hash" => $row['phone_hash'],
        "user_id" => $row['user_id'],
        "server_name" => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')),
        "photo_url" => $photoUrl,
        "short_note" => $row['short_note'] ?? null,
        "status" => "on_chatflect"
    ];
}

echo json_encode([
    "success" => true,
    "matches" => $matches
]);
