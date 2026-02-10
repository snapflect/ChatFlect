<?php
// api/v4/security/ban.php
// Admin Endpoint: Manually Ban IP/User/Device

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/abuse_guard.php';

header('Content-Type: application/json');

// Admin Auth (Reusing strict logic)
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$type = $data['type'] ?? null; // IP, USER, DEVICE
$value = $data['value'] ?? null;
$duration = $data['duration'] ?? '1 HOUR';

if (!$type || !$value) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_PARAMS']);
    exit;
}

$guard = new AbuseGuard($pdo);
$guard->ban($type, $value, $duration, 'ADMIN_MANUAL_BAN');

echo json_encode(['success' => true, 'msg' => "$type $value banned for $duration"]);
