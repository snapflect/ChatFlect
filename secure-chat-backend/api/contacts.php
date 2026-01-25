<?php
// contacts.php - Sync Contacts
// Fixes: P30, P31, P32, P33, P34
require 'db.php';

// Headers handled by db.php
require_once 'rate_limiter.php';
enforceRateLimit();


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

/* ---------- BASE URL (CONSISTENT) ---------- */
function getBaseUrl(): string
{
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $protocol . '://' . $_SERVER['HTTP_HOST'];
}

/* ---------- INPUT ---------- */
$data = json_decode(file_get_contents("php://input"));

// Email Discovery Support
if (isset($data->query) && !empty($data->query)) {
    $search = "%" . sanitizeString($data->query) . "%";
    $stmt = $conn->prepare("SELECT user_id, email, phone_number, first_name, last_name, photo_url FROM users WHERE email LIKE ? OR first_name LIKE ? OR last_name LIKE ? LIMIT 20");
    $stmt->bind_param("sss", $search, $search, $search);
    $stmt->execute();
    $result = $stmt->get_result();
    $matches = [];
    while ($user = $result->fetch_assoc()) {
        $matches[] = $user;
    }
    echo json_encode($matches);
    exit;
}

if (!isset($data->phone_numbers) || !is_array($data->phone_numbers)) {
    echo json_encode([]);
    exit;
}

$phones = array_map(
    fn($p) => substr(preg_replace('/[^0-9]/', '', $p), -10),
    $data->phone_numbers
);

if (!$phones) {
    echo json_encode([]);
    exit;
}

/* ---------- SAFE SQL COMPATIBILITY FIX ---------- */
// Instead of REGEXP_REPLACE (MySQL 8.0+), use standard LIKE matching
$whereClauses = [];
$types = "";
$params = [];

foreach ($phones as $p) {
    // Sanitize to last 10 digits to match DB format regardless of country code
    $clean = preg_replace('/[^0-9]/', '', $p);
    if (strlen($clean) >= 10) {
        $last10 = substr($clean, -10);
        // Standard Match: Data is clean, and charset is now enforced in db.php
        $whereClauses[] = "phone_number LIKE CONCAT('%', ?)";
        $params[] = $last10;
        $types .= "s";
    }
}

if (empty($whereClauses)) {
    echo json_encode([]);
    exit;
}

$sql = "SELECT user_id, phone_number, first_name, last_name, photo_url FROM users WHERE " . implode(" OR ", $whereClauses);

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();

$baseUrl = getBaseUrl();
$matches = [];

while ($user = $result->fetch_assoc()) {

    /* ---------- P31 FIX ---------- */
    if (empty($user['photo_url'])) {
        $user['photo_url'] = null;
    }
    /* ---------- STANDARD PROXY FIX ---------- */ elseif (strpos($user['photo_url'], 'http') !== 0) {
        // Return relative path pointing to local proxy
        $user['photo_url'] = 'serve.php?file=' . ltrim($user['photo_url'], '/');
    }

    $matches[] = $user;
}

echo json_encode($matches);
