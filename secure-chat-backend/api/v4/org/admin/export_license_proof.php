<?php
// api/v4/org/admin/export_license_proof.php
// Epic 67 HF: Signed License Proof

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/license_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']);

    $licMgr = new LicenseManager($pdo);
    $lic = $licMgr->getLicense($orgIdBin);

    // Proof Payload
    $proof = [
        'org_id' => $orgIdHex,
        'plan' => $lic['plan_id'],
        'seats' => $lic['seat_limit'],
        'status' => $lic['subscription_status'],
        'expires_at' => $lic['expires_at'],
        'proof_generated_at' => date('c'),
        'generated_by' => $user['user_id']
    ];

    $json = json_encode($proof, JSON_PRETTY_PRINT);

    // Sign
    $privateKeyPath = __DIR__ . '/../../../../keys/server_private.pem';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
        $proof['_signature'] = base64_encode($signature);
    } else {
        $proof['_signature'] = 'DEV_UNSIGNED';
    }

    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="license_proof.json"');
    echo json_encode($proof, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
