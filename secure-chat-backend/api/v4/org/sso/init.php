<?php
// api/v4/org/sso/init.php
// Epic 65: Start SSO Flow

require_once __DIR__ . '/../../../../includes/db_connect.php';
require_once __DIR__ . '/../../../../includes/sso_manager.php';
require_once __DIR__ . '/../../../../includes/env.php';

$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new SSOManager($pdo);
    $config = $mgr->getSettings($orgIdBin);

    if (!$config)
        throw new Exception("SSO not configured for this Org");

    // Generate State
    $state = bin2hex(random_bytes(32));
    $stmt = $pdo->prepare("INSERT INTO org_sso_states (state_token, org_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))");
    $stmt->execute([$state, $orgIdBin]);

    // Construct Redirect URL
    // Standard OIDC
    $redirectUri = getenv('APP_URL') . '/api/v4/org/sso/callback.php';
    $authUrl = $config['issuer_url'] . '/authorize?' . http_build_query([
        'client_id' => $config['client_id'],
        'response_type' => 'code', // Or id_token if implicit
        'scope' => 'openid email profile',
        'redirect_uri' => $redirectUri,
        'state' => $state,
        'nonce' => bin2hex(random_bytes(16))
    ]);

    // Redirect User
    header("Location: $authUrl");
    exit;

} catch (Exception $e) {
    http_response_code(400);
    echo "SSO Error: " . $e->getMessage();
}
