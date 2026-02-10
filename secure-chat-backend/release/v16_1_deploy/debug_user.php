<?php
require 'db.php';
header('Content-Type: application/json');

$userId = $_GET['user_id'] ?? '';
if (!$userId) die(json_encode(["error" => "no user_id"]));

$stmt = $conn->prepare("SELECT * FROM users WHERE user_id = ?");
$stmt->bind_param("s", $userId);
$stmt->execute();
$res = $stmt->get_result();
$user = $res->fetch_assoc();

echo json_encode($user);
?>
