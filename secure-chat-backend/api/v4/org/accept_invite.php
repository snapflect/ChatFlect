<?php
// api/v4/org/accept_invite.php
// Epic 60: Accept Invite API

require_once __DIR__ . '/../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../includes/org_invite_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$token = $input['token'];

try {
    $mgr = new OrgInviteManager($pdo);
    $orgIdHex = $mgr->acceptInvite($token, $user['user_id']);

    echo json_encode(['success' => true, 'org_id' => $orgIdHex]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
