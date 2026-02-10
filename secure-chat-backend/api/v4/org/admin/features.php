<?php
// api/v4/org/admin/features.php
// Epic 68: View Features

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/feature_gate.php';
require_once __DIR__ . '/../../../../includes/feature_registry.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']);

    $gate = new FeatureGate($pdo);
    $features = [];

    foreach (FeatureRegistry::FEATURES as $key => $name) {
        $features[$key] = [
            'name' => $name,
            'enabled' => $gate->check($orgIdBin, $key)
        ];
    }

    echo json_encode(['features' => $features]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
