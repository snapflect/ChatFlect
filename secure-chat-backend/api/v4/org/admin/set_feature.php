<?php
// api/v4/org/admin/set_feature.php
// Epic 68: Toggle Feature (Governed)

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/governance_engine.php';
require_once __DIR__ . '/../../../../includes/feature_registry.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $feature = $input['feature_key'];
    $enable = (bool) $input['enabled'];

    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']);

    if (!FeatureRegistry::isValid($feature))
        throw new Exception("Invalid Feature");

    $govEngine = new GovernanceEngine($pdo);

    $target = [
        'org_id' => $input['org_id'],
        'feature_key' => $feature,
        'enabled' => $enable
    ];

    // Add ORG_UPDATE_FEATURE to governance types if strictly needed, 
    // or reuse generic config update.
    // Assuming 'ORG_UPDATE_FEATURE' needs to be added to migration or use generic description.

    $reqId = $govEngine->requestAction(
        $user['user_id'],
        'ORG_UPDATE_FEATURE',
        $target,
        ($enable ? "Enable" : "Disable") . " Feature: $feature"
    );
    echo json_encode(['success' => true, 'request_id' => $reqId, 'status' => 'PENDING_APPROVAL']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
