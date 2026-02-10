<?php
// api/v4/admin/reject_action.php
// Epic 58: Reject action

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/admin_action_manager.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

$headers = getallheaders();
if (($headers['X-Admin-Secret'] ?? '') !== getenv('ADMIN_SECRET_KEY')) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$adminId = $headers['X-Admin-ID'] ?? 0;
$input = json_decode(file_get_contents('php://input'), true);

try {
    $mgr = new AdminActionManager($pdo);
    $mgr->reject($input['request_id'], $adminId, $input['reason'] ?? 'No reason');

    echo json_encode(['success' => true, 'status' => 'REJECTED']);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
