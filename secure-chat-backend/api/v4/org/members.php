<?php
// api/v4/org/members.php
// Epic 60: List Org Members API

require_once __DIR__ . '/../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../includes/org_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgMgr = new OrgManager($pdo);
    $orgIdBin = hex2bin($orgIdHex);

    // Check Membership (Any member can view member list usually, or strict to ADMIN?)
    // Let's allow any member.
    $role = $orgMgr->getMemberRole($orgIdBin, $user['user_id']);
    if (!$role) {
        http_response_code(403);
        echo json_encode(['error' => 'Not a member']);
        exit;
    }

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
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
