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

// HF-51.1: Advanced Rate Limiting (Composite IP + AdminToken)
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$bucketKey = md5($receivedSecret . '|' . $clientIp);
$rateLimitFile = sys_get_temp_dir() . '/admin_rate_limit_' . $bucketKey;

// Settings
$rateLimitWindow = 60; // 1 minute
$maxRequests = 10;
$banThreshold = 50; // 5x limit = Ban

$data = @json_decode(@file_get_contents($rateLimitFile), true) ?? ['count' => 0, 'start' => time(), 'banned' => false];

// Check Ban
if (!empty($data['banned']) && $data['banned'] > time()) {
    http_response_code(403);
    echo json_encode(['error' => 'IP_BANNED_TEMPORARILY']);
    exit;
}

// Reset Window
if (time() - $data['start'] > $rateLimitWindow) {
    if ($data['count'] > $maxRequests) {
        // Log abuse before reset?
    }
    $data['count'] = 0;
    $data['start'] = time();
}

// Check Limit
if ($data['count'] >= $maxRequests) {
    // Ban Logic: If hitting limit excessively
    if ($data['count'] >= $banThreshold) {
        $data['banned'] = time() + 3600; // 1 Hour Ban
        file_put_contents($rateLimitFile, json_encode($data));
        http_response_code(403);
        echo json_encode(['error' => 'IP_BANNED_TEMPORARILY']);
        exit;
    }

    file_put_contents($rateLimitFile, json_encode($data)); // Save state even on block
    http_response_code(429);
    echo json_encode(['error' => 'RATE_LIMIT_EXCEEDED']);
    exit;
}

// Increment
$data['count']++;
file_put_contents($rateLimitFile, json_encode($data));

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
