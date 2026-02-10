<?php
// api/v4/org/compliance/export_org_compliance.php
// Epic 63: Request Compliance Export

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/governance_engine.php';
require_once __DIR__ . '/../../../../includes/compliance_export_engine.php'; // For direct exec if needed or reference

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $adminMgr = new OrgAdminManager($pdo);
    $adminMgr->ensureAdmin($orgIdBin, $user['user_id']); // Admin check

    // Start/End Dates
    $start = $input['start_date'] ?? date('Y-m-d H:i:s', strtotime('-30 days'));
    $end = $input['end_date'] ?? date('Y-m-d H:i:s');

    // Request Governance
    $govEngine = new GovernanceEngine($pdo);
    $target = ['org_id' => $input['org_id'], 'start' => $start, 'end' => $end];

    $reqId = $govEngine->requestAction(
        $user['user_id'],
        'ORG_EXPORT_COMPLIANCE',
        $target,
        "Compliance Export ($start to $end)"
        // No heavy payload, parameters are in target/reason
    );

    echo json_encode(['success' => true, 'request_id' => $reqId, 'status' => 'PENDING_APPROVAL']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
