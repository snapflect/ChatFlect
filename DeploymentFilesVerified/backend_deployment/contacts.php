<?php
// contacts.php - Sync Contacts
require 'db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

// POST { phone_numbers: ["+123", "+456"] }
$json = file_get_contents("php://input");
$data = json_decode($json);

if (!isset($data->phone_numbers) || !is_array($data->phone_numbers)) {
    echo json_encode([]);
    exit;
}

$phones = $data->phone_numbers;
// Sanitize
$phones = array_map(function ($p) {
    return preg_replace('/[^0-9+]/', '', $p);
}, $phones);

if (empty($phones)) {
    echo json_encode([]);
    exit;
}

// 1. Fetch ALL registered users (Lightweight for demo / <10k users)
$result = $conn->query("SELECT user_id, phone_number, first_name, last_name, photo_url, public_key FROM users");
$allUsers = [];
while ($row = $result->fetch_assoc()) {
    $allUsers[] = $row;
}

$matches = [];

// 2. Fuzzy Match in PHP (Match last 10 digits)
// This solves the +91 vs 0 vs raw issue without complex SQL
foreach ($allUsers as $user) {
    $dbPhone = preg_replace('/[^0-9]/', '', $user['phone_number']);
    $dbLast10 = substr($dbPhone, -10);

    foreach ($phones as $contactPhone) {
        $contactClean = preg_replace('/[^0-9]/', '', $contactPhone);
        $contactLast10 = substr($contactClean, -10);

        if ($dbLast10 === $contactLast10) {
            $matches[] = $user;
            break; // Found match for this user
        }
    }
}

echo json_encode($matches);
?>