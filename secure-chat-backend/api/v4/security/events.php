<?php
// api/v4/security/events.php
// Admin Endpoint: Retrieve audit logs
// Requires ADMIN_SECRET in header

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

// 1. Admin Auth Check
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY'); // Must be set in .env
$receivedSecret = $headers['X-Admin-Secret'] ?? '';

if (!$adminSecret || $receivedSecret !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

// 2. Query Params
$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
$severity = $_GET['severity'] ?? null;
$eventType = $_GET['event_type'] ?? null;

$sql = "SELECT * FROM security_audit_log WHERE 1=1";
$params = [];

if ($severity) {
    $sql .= " AND severity = ?";
    $params[] = $severity;
}
if ($eventType) {
    $sql .= " AND event_type = ?";
    $params[] = $eventType;
}

$sql .= " ORDER BY created_at DESC LIMIT ?";
$params[] = $limit;

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'logs' => $logs]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB_ERROR']);
}
