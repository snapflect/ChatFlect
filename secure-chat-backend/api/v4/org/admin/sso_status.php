<?php
// api/v4/org/admin/sso_status.php
// Epic 65: View SSO Status

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/sso_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']);

    $ssoMgr = new SSOManager($pdo);
    $settings = $ssoMgr->getSettings($orgIdBin);

    if (!$settings) {
        echo json_encode(['configured' => false]);
    } else {
        // Redact secrets
        unset($settings['client_secret']);
        echo json_encode(['configured' => true, 'settings' => $settings]);
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
