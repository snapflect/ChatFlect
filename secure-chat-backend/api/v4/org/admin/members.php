<?php
// api/v4/org/admin/members.php
// Epic 61: List Members (Admin View)

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']); // Enforce Access

    // Reuse normal members list but maybe with more info?
    // Using simple query for now
    $stmt = $pdo->prepare("
        SELECT u.id, u.username, u.email, m.role, m.joined_at, m.status 
        FROM org_members m 
        JOIN users u ON m.user_id = u.id 
        WHERE m.org_id = ?
    ");
    $stmt->execute([$orgIdBin]);
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['members' => $members]);

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
