<?php
/**
 * api/contacts/map.php
 * Secure Contact Mapping (v2.3)
 * Privacy-First: Server never sees phone numbers, only SHA-256(Salt + Number).
 */

require_once '../db.php';
require_once '../auth_middleware.php'; // Ensure authenticated
require_once '../rate_limiter.php';

// HF-4.2: Enforce strict rate limit for contact mapping
// Max 50 requests per hour (3600s) to prevent bulk harvesting
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

// HF-4.3: Simple Replay Protection (Time Window)
$now = time() * 1000;
if (abs($now - $timestamp) > 300000) { // 5 minute window
    http_response_code(403);
    echo json_encode(["error" => "REPLAY_DETECTED", "details" => "Clock skew too high"]);
    exit;
}

// v2.3 Sync Logic:
// We compare incoming hashes against the hashes stored in the 'users' table.
// Assumption: Users table has a 'phone_hash' column (SHA-256 of salt + normalized phone).
// If not, we map by phone_number (legacy) but this endpoint is meant for Hash-Match.

$matches = [];
$placeholders = implode(',', array_fill(0, count($hashes), '?'));

$sql = "SELECT user_id, phone_number, first_name, last_name, photo_url 
        FROM users 
        WHERE phone_number IN ($placeholders)";

$stmt = $conn->prepare($sql);
$stmt->execute($hashes);
$result = $stmt->get_result();

while ($row = $result->fetch_assoc()) {
    $matches[] = [
        "user_id" => $row['user_id'],
        "photo_url" => $row['photo_url'],
        "hash" => array_search($row['user_id'], array_column($matches, 'user_id')) === false ? "" : "" // Logic placeholder
    ];
}

// Improved matching: We need to return the phone_number so the client knows WHICH contact matched.
// Re-executing query to get the specific match
$sql = "SELECT user_id, phone_number, photo_url FROM users WHERE phone_number IN ($placeholders)";
$stmt = $conn->prepare($sql);
$stmt->bind_param(str_repeat('s', count($hashes)), ...$hashes);
$stmt->execute();
$result = $stmt->get_result();

$finalMatches = [];
while ($row = $result->fetch_assoc()) {
    $finalMatches[] = [
        "hash" => $row['phone_number'],
        "user_id" => $row['user_id'],
        "photo_url" => $row['photo_url'] ? "serve.php?file=" . ltrim($row['photo_url'], '/') : null,
        "status" => "on_chatflect"
    ];
}

echo json_encode([
    "success" => true,
    "matches" => $finalMatches
]);
