<?php
// api/v4/org/admin/sso_configure.php
// Epic 65: Configure SSO

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgIdBin = hex2bin($input['org_id']);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']); // Only Admin

    // Upsert Settings
    $sql = "INSERT INTO org_sso_settings 
            (org_id, issuer_url, client_id, allowed_domains, updated_by)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            issuer_url=VALUES(issuer_url), 
            client_id=VALUES(client_id), 
            allowed_domains=VALUES(allowed_domains),
            updated_by=VALUES(updated_by)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $orgIdBin,
        $input['issuer_url'],
        $input['client_id'],
        $input['allowed_domains'],
        $user['user_id']
    ]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
