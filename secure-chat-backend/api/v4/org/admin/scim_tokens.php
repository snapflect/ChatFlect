<?php
// api/v4/org/admin/scim_tokens.php
// Epic 66: Manage SCIM Tokens

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

// Action: Generate or List
$action = $_GET['action'] ?? 'list';
$orgIdHex = $_GET['org_id'] ?? $input['org_id'];

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']); // Admin Only

    if ($action === 'create') {
        // Generate Token
        $rawToken = bin2hex(random_bytes(32));
        $hash = hash('sha256', $rawToken);
        $desc = $input['description'] ?? 'SCIM Token';

        $stmt = $pdo->prepare("INSERT INTO scim_tokens (org_id, token_hash, description, created_by) VALUES (?, ?, ?, ?)");
        $stmt->execute([$orgIdBin, $hash, $desc, $user['user_id']]);

        echo json_encode(['token' => $rawToken]); // Show ONCE
    } elseif ($action === 'revoke') {
        $tokenId = $input['token_id'];
        $stmt = $pdo->prepare("UPDATE scim_tokens SET revoked = 1 WHERE token_id = ? AND org_id = ?");
        $stmt->execute([$tokenId, $orgIdBin]);
        echo json_encode(['success' => true]);
    } else {
        // List
        $stmt = $pdo->prepare("SELECT token_id, description, created_at, last_used_at, revoked FROM scim_tokens WHERE org_id = ?");
        $stmt->execute([$orgIdBin]);
        echo json_encode(['tokens' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
