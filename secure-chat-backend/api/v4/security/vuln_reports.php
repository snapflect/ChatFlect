<?php
// api/v4/security/vuln_reports.php
// Epic 57: Admin Vulnerability Report Viewer

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

// Admin Auth
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$status = $_GET['status'] ?? null;
$sql = "SELECT * FROM vulnerability_reports";
$params = [];

if ($status) {
    $sql .= " WHERE status = ?";
    $params[] = $status;
}

$sql .= " ORDER BY created_at DESC LIMIT 50";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Decode JSON payloads for display
foreach ($reports as &$r) {
    $r['payload_json'] = json_decode($r['payload_json']);
}

echo json_encode(['success' => true, 'reports' => $reports]);
