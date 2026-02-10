<?php
// api/v4/org/admin/license_audit.php
// Epic 67: View License History

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']);

    $stmt = $pdo->prepare("SELECT * FROM org_license_events WHERE org_id = ? ORDER BY created_at DESC");
    $stmt->execute([$orgIdBin]);

    echo json_encode(['history' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
