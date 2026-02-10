<?php
// api/v4/org/admin/request_archive_export.php
// Epic 64: Request Archive Bundle (Governed)

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/governance_engine.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $snapshotId = $input['snapshot_id'];

    $adminMgr = new OrgAdminManager($pdo);
    $adminMgr->ensureAdmin($orgIdBin, $user['user_id']);

    $govEngine = new GovernanceEngine($pdo);

    // Request access to specific snapshot
    $reqId = $govEngine->requestAction(
        $user['user_id'],
        'ORG_EXPORT_ARCHIVE', // Needs definition
        ['org_id' => $input['org_id'], 'snapshot_id' => $snapshotId],
        "Access Archive Snapshot $snapshotId"
    );

    echo json_encode(['success' => true, 'request_id' => $reqId, 'status' => 'PENDING_APPROVAL']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
