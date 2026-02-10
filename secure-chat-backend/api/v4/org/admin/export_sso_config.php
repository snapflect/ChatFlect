<?php
// api/v4/org/admin/export_sso_config.php
// Epic 65 HF: Signed SSO Config Export

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

    if (!$settings)
        throw new Exception("SSO Not Configured");

    // Mask Secret
    $settings['client_secret'] = 'REDACTED_FOR_EXPORT';

    $payload = [
        'org_id' => $orgIdHex,
        'config' => $settings,
        'exported_at' => date('c'),
        'exported_by' => $user['user_id']
    ];

    $json = json_encode($payload, JSON_PRETTY_PRINT);

    // Sign
    $privateKeyPath = __DIR__ . '/../../../../keys/server_private.pem';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
        $payload['_signature'] = base64_encode($signature);
    } else {
        $payload['_signature'] = 'DEV_UNSIGNED';
    }

    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="sso_config.json"');
    echo json_encode($payload, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
