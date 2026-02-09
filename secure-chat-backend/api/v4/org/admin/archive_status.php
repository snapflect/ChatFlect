<?php
// api/v4/org/admin/archive_status.php
// Epic 64: View Archives

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $adminMgr = new OrgAdminManager($pdo);
    $adminMgr->ensureAdmin($orgIdBin, $user['user_id']);

    $stmt = $pdo->prepare("SELECT snapshot_id, snapshot_date, status, file_hash, created_at FROM archive_snapshots WHERE org_id = ? ORDER BY snapshot_date DESC");
    $stmt->execute([$orgIdBin]);
    $archives = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['archives' => $archives]);

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
