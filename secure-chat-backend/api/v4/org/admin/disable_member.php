<?php
// api/v4/org/admin/disable_member.php
// Epic 61: Disable Member

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $mgr = new OrgAdminManager($pdo);

    $mgr->disableMember($orgIdBin, $input['target_user_id'], $user['user_id']);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
