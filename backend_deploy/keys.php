<?php
require 'db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// GET { user_id } -> Return Public Key
// GET { phone_number } -> Return Public Key (for contacts)

if (isset($_GET['user_id'])) {
    $stmt = $pdo->prepare("SELECT public_key FROM users WHERE user_id = ?");
    $stmt->execute([$_GET['user_id']]);
} elseif (isset($_GET['phone_number'])) {
    $stmt = $pdo->prepare("SELECT id, public_key FROM users WHERE phone_number = ?");
    $stmt->execute([$_GET['phone_number']]);
} else {
    echo json_encode(["error" => "Missing param"]);
    exit;
}

$result = $stmt->fetch();
if ($result) {
    echo json_encode($result);
} else {
    http_response_code(404);
    echo json_encode(["error" => "User/Key not found"]);
}
?>