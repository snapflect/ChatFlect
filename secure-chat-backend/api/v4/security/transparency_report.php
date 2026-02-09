<?php
// api/v4/security/transparency_report.php
// Epic 56: transparency Report API

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

// Public or Admin?
// Usually public, but maybe we require at least a valid session or API key.
// Let's make it Admin for now, with idea that Frontend consumes it for a public page.

$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

// List or Get
$id = $_GET['id'] ?? null;

if ($id) {
    $stmt = $pdo->prepare("SELECT * FROM transparency_reports WHERE report_id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $row['report_json'] = json_decode($row['report_json']);
        echo json_encode(['success' => true, 'report' => $row]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'NOT_FOUND']);
    }
} else {
    $stmt = $pdo->query("SELECT report_id, period_start, period_end, generated_at FROM transparency_reports ORDER BY period_start DESC");
    echo json_encode(['success' => true, 'reports' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}
