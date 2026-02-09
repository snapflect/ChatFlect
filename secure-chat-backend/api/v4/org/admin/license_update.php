<?php
// api/v4/org/admin/license_update.php
// Epic 67: Update License (Governed)

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/governance_engine.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $plan = $input['plan_id'];
    $seats = (int) $input['seat_limit'];

    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']);

    // Changing License is HUGE. Must be Governed.
    $govEngine = new GovernanceEngine($pdo);
    // Assuming 'ORG_LICENSE_UPDATE' exists or using generic.
    // Let's use generic or placeholder

    $target = [
        'org_id' => $input['org_id'],
        'plan_id' => $plan,
        'seats' => $seats
    ];

    $reqId = $govEngine->requestAction(
        $user['user_id'],
        'ORG_LICENSE_UPDATE', // Needs migration add
        $target,
        "Update License to $plan ($seats seats)"
    );
    echo json_encode(['success' => true, 'request_id' => $reqId, 'status' => 'PENDING_APPROVAL']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
