<?php
// api/v4/org/admin/policy_history.php
// Epic 62: Policy History

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/org_policy_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $adminMgr = new OrgAdminManager($pdo);
    $adminMgr->ensureAdmin($orgIdBin, $user['user_id']);

    $policyMgr = new OrgPolicyManager($pdo);
    $history = $policyMgr->getHistory($orgIdBin);

    echo json_encode(['history' => $history]);

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
