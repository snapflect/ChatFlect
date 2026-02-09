<?php
// api/v4/security/vuln_update.php
// Epic 57: Admin Vulnerability Status Update

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';
require_once __DIR__ . '/../../../includes/vuln_report_manager.php';

header('Content-Type: application/json');

// Admin Auth
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['report_id']) || !isset($input['status'])) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_PARAMS']);
    exit;
}

try {
    $manager = new VulnReportManager($pdo);
    $manager->updateStatus($input['report_id'], $input['status'], $input['note'] ?? null, 'AdminAPI');

    echo json_encode(['success' => true, 'message' => 'Status Updated']);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
