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

// HF-51.1: Rate Limiting (Simple File-based for now, Redis recommended for prod)
$rateLimitFile = sys_get_temp_dir() . '/admin_rate_limit_' . md5($receivedSecret);
$rateLimitWindow = 60; // 1 minute
$maxRequests = 10;

$current = (int) @file_get_contents($rateLimitFile);
$mtime = @filemtime($rateLimitFile);

if ($mtime && (time() - $mtime > $rateLimitWindow)) {
    $current = 0; // Reset
}

if ($current >= $maxRequests) {
    http_response_code(429);
    echo json_encode(['error' => 'RATE_LIMIT_EXCEEDED']);
    exit;
}

file_put_contents($rateLimitFile, $current + 1);

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
