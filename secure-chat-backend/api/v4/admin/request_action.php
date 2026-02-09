<?php
// api/v4/admin/request_action.php
// Epic 58: Request a privileged action

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/admin_action_manager.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

// Admin Auth (Mock - assumes X-Admin-ID header for now alongside Secret)
// In real system, ID comes from session token.
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$adminId = $headers['X-Admin-ID'] ?? 0; // Simulated ID
if (!$adminId) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_ADMIN_ID']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!isset($input['type']) || !isset($input['target']) || !isset($input['reason'])) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_PARAMS']);
    exit;
}

try {
    $mgr = new AdminActionManager($pdo);
    $id = $mgr->request($adminId, $input['type'], $input['target'], $input['reason']);

    echo json_encode([
        'success' => true,
        'request_id' => $id,
        'status' => 'PENDING',
        'message' => 'Action queued for approval.'
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
