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
    return preg_replace('/[^0-9+]/', '', $p); }, $phones);

if (empty($phones)) {
    echo json_encode([]);
    exit;
}

// Build Query IN (?,?,?)
$placeholders = implode(',', array_fill(0, count($phones), '?'));
$stmt = $pdo->prepare("SELECT user_id, phone_number, first_name, last_name, photo_url, public_key FROM users WHERE phone_number IN ($placeholders)");
$stmt->execute($phones);
$matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($matches);
?>