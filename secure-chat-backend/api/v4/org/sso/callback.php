<?php
// api/v4/org/sso/callback.php
// Epic 65: SSO Callback

require_once __DIR__ . '/../../../../includes/db_connect.php';
require_once __DIR__ . '/../../../../includes/sso_manager.php';
require_once __DIR__ . '/../../../../includes/oidc_validator.php';
require_once __DIR__ . '/../../../../includes/session_helper.php'; // Hypothetical

$state = $_GET['state'] ?? '';
$code = $_GET['code'] ?? '';

try {
    // Validate State
    $stmt = $pdo->prepare("SELECT org_id FROM org_sso_states WHERE state_token = ? AND status='PENDING' AND expires_at > NOW()");
    $stmt->execute([$state]);
    $orgIdBin = $stmt->fetchColumn();

    if (!$orgIdBin)
        throw new Exception("Invalid or Expired State");

    // Mark Consumed
    $pdo->prepare("UPDATE org_sso_states SET status='CONSUMED' WHERE state_token = ?")->execute([$state]);

    // Get Config
    $mgr = new SSOManager($pdo);
    $config = $mgr->getSettings($orgIdBin);

    // Exchange Code for Token (Direct HTTP call to Token Endpoint)
    // Mocking Token Exchange for Snippet:
    // In Real Life: curl_init() to $config['issuer_url'] . '/token'
    // Assume we got $idToken
    $idToken = "HEADER." . base64_encode(json_encode([
        'iss' => $config['issuer_url'],
        'exp' => time() + 3600,
        'email' => 'user@allowed.com', // Dynamic
        'sub' => '12345'
    ])) . ".SIG";

    // Validate
    $validator = new OIDCValidator();
    $claims = $validator->validateToken($idToken, $config['issuer_url'], $config['client_id']);

    // Domain Check
    if (!$mgr->isValidDomain($claims['email'], $config['allowed_domains'])) {
        throw new Exception("Email domain not authorized for this Organization");
    }

    // Map User
    $userId = $mgr->provisionUser($claims['email'], $orgIdBin);
    if (!$userId)
        throw new Exception("User provisioning failed (or user not found)");

    // Create Session
    // issue_session_token($userId);
    echo "Login Success: " . $claims['email'];

} catch (Exception $e) {
    echo "SSO Failed: " . $e->getMessage();
}
