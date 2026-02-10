<?php
// api/v4/org/admin/export_policy.php
// Epic 62 HF: Signed Policy Export

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/org_policy_manager.php';
require_once __DIR__ . '/../../../../includes/env.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']); // Admin check

    $policyMgr = new OrgPolicyManager($pdo);
    $currentPolicy = $policyMgr->getActivePolicy($orgIdBin);
    $history = $policyMgr->getHistory($orgIdBin);

    $payload = [
        'org_id' => $orgIdHex,
        'exported_at' => date('c'),
        'exported_by' => $user['user_id'],
        'active_policy' => $currentPolicy,
        'history_snapshot' => array_slice($history, 0, 10) // Top 10 history items
    ];

    // Sign
    $json = json_encode($payload, JSON_PRETTY_PRINT);
    $privateKeyPath = __DIR__ . '/../../../../keys/server_private.pem';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
        $payload['_signature'] = base64_encode($signature);
    } else {
        $payload['_signature'] = 'DEV_MODE_UNSIGNED';
    }

    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="org_policy_signed.json"');
    echo json_encode($payload, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
