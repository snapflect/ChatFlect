<?php
// api/v4/org/admin/request_archive_restore.php
// Epic 64 HF: Governed Archive Restore

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/governance_engine.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $snapshotId = $input['snapshot_id']; // Hex

    $adminMgr = new OrgAdminManager($pdo);
    $adminMgr->ensureAdmin($orgIdBin, $user['user_id']); // Admin check

    // HF-64.5: Governed Restore
    $govEngine = new GovernanceEngine($pdo);

    $target = [
        'org_id' => $input['org_id'],
        'snapshot_id' => $snapshotId,
        'restore_scope' => 'FULL' // or 'PARTIAL'
    ];

    $reqId = $govEngine->requestAction(
        $user['user_id'],
        'ORG_RESTORE_ARCHIVE',
        $target,
        "Restore Archive Snapshot $snapshotId"
    );

    echo json_encode(['success' => true, 'request_id' => $reqId, 'status' => 'PENDING_APPROVAL']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
