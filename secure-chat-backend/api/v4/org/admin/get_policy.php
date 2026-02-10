<?php
// api/v4/org/admin/get_policy.php
// Epic 62: Get Current Policy

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/org_policy_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $adminMgr = new OrgAdminManager($pdo);
    $adminMgr->ensureAdmin($orgIdBin, $user['user_id']); // Admin check

    $policyMgr = new OrgPolicyManager($pdo);
    $policy = $policyMgr->getActivePolicy($orgIdBin);

    echo json_encode(['policy' => $policy]);

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
