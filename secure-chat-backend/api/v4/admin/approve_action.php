<?php
// api/v4/admin/approve_action.php
// Epic 58: Approve a privileged action

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/admin_action_manager.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$adminId = $headers['X-Admin-ID'] ?? 0;
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['request_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_ID']);
    exit;
}

try {
    $mgr = new AdminActionManager($pdo);
    $status = $mgr->approve($input['request_id'], $adminId);

    echo json_encode([
        'success' => true,
        'new_status' => $status
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
