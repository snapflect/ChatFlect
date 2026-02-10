<?php
// api/v4/org/admin/remove_member.php
// Epic 61: Remove Member (Kick)

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_manager.php'; // Reuse base logic
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $adminMgr = new OrgAdminManager($pdo);
    $adminMgr->ensureAdmin($orgIdBin, $user['user_id']);

    $orgMgr = new OrgManager($pdo);
    $orgMgr->removeMember($orgIdBin, $input['target_user_id'], $user['user_id']); // Uses base logic with safety checks

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
