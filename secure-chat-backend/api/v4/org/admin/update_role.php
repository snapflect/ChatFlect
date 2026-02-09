<?php
// api/v4/org/admin/update_role.php
// Epic 61: Update Member Role

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $mgr = new OrgAdminManager($pdo);

    // ensureAdmin is called inside updateMemberRole or implicitly. 
    // Let's call it explicitly for clarity/security at gateway.
    $mgr->ensureAdmin($orgIdBin, $user['user_id']);

    $mgr->updateMemberRole($orgIdBin, $input['target_user_id'], $input['new_role'], $user['user_id']);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
