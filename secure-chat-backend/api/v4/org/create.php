<?php
// api/v4/org/create.php
// Epic 60: Create Organization API

require_once __DIR__ . '/../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../includes/org_manager.php';

$user = authenticate(); // Returns user_id
$input = json_decode(file_get_contents('php://input'), true);

try {
    $mgr = new OrgManager($pdo);
    $orgId = $mgr->createOrg($user['user_id'], $input['name'], $input['slug']);

    echo json_encode(['success' => true, 'org_id' => $orgId]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
