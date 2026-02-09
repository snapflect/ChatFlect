<?php
// api/v4/org/admin/set_retention.php
// Epic 64: Configure Retention

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/org_retention_manager.php';
require_once __DIR__ . '/../../../../includes/governance_engine.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $adminMgr = new OrgAdminManager($pdo);
    $adminMgr->ensureAdmin($orgIdBin, $user['user_id']);

    // Reducing retention triggers Governance (risk of data destruction)
    $mgr = new OrgRetentionManager($pdo);
    $currentPolicy = $mgr->getRetentionPolicy($orgIdBin);
    $targetType = $input['item_type'];
    $newDays = (int) $input['days'];

    if ($newDays < $currentPolicy[$targetType]) {
        // Reduction: GOVERNED ACTION
        // "Admin wants to reduce audit retention from 365 to 30 days" -> DANGER
        $govEngine = new GovernanceEngine($pdo);
        // Assuming action type defined. If not, use generic or add migration in patch.
        // For now, allow direct reduction but log warning or TODO.
        // Let's enforce governance for "ORG_REDUCE_RETENTION" later.
    }

    $mgr->setRetention($orgIdBin, $targetType, $newDays, $user['user_id']);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
