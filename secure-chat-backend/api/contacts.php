<?php
// contacts.php - Sync Contacts
// Fixes: P30, P31, P32, P33, P34
require 'db.php';

// Headers handled by db.php
require_once 'rate_limiter.php';
enforceRateLimit(null, RATE_LIMIT_CONTACTS);


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
$whereClauses = [];
$params = [];
$types = "";

// Email Discovery Support
if (isset($data->query) && !empty($data->query)) {
    $queryString = sanitizeString($data->query);
    $cacheKey = "contact_search:" . md5($queryString);

    $cached = CacheService::get($cacheKey);
    if ($cached) {
        echo json_encode($cached);
        exit;
    }

    $search = "%" . $queryString . "%";
    $stmt = $conn->prepare("SELECT user_id, email, phone_number, first_name, last_name, photo_url FROM users WHERE email LIKE ? OR first_name LIKE ? OR last_name LIKE ? LIMIT 20");
    $stmt->bind_param("sss", $search, $search, $search);
    $stmt->execute();
    $result = $stmt->get_result();
    $matches = [];
    while ($user = $result->fetch_assoc()) {
        $matches[] = $user;
    }

    CacheService::set($cacheKey, $matches, 300); // Cache for 5 mins
    echo json_encode($matches);
    exit;
}

// Hashed Matching (ZK-S)
$hashedPhones = [];
if (isset($data->phone_hashes) && is_array($data->phone_hashes)) {
    foreach ($data->phone_hashes as $h) {
        if (preg_match('/^[a-f0-9]{64}$/', $h)) {
            $hashedPhones[] = $h;
        }
    }
}

if (empty($whereClauses) && empty($hashedPhones)) {
    echo json_encode([]);
    exit;
}

$sql = "SELECT user_id, phone_number, first_name, last_name, photo_url FROM users WHERE ";
$conditions = [];

if (!empty($whereClauses)) {
    $conditions[] = "(" . implode(" OR ", $whereClauses) . ")";
}
if (!empty($hashedPhones)) {
    $placeholders = implode(',', array_fill(0, count($hashedPhones), '?'));
    $conditions[] = "phone_hash IN ($placeholders)";
    foreach ($hashedPhones as $h) {
        $params[] = $h;
        $types .= "s";
    }
}

$sql .= implode(" OR ", $conditions);

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
