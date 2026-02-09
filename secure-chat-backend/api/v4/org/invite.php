<?php
// api/v4/org/invite.php
// Epic 60: Invite User to Org API

require_once __DIR__ . '/../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../includes/org_manager.php';
require_once __DIR__ . '/../../../includes/org_invite_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

$orgIdHex = $input['org_id'];
$email = $input['email'];
$role = $input['role'] ?? 'MEMBER';

try {
    $orgMgr = new OrgManager($pdo);
    $orgIdBin = hex2bin($orgIdHex);

    // Check Permission (Must be ADMIN or OWNER)
    $inviterRole = $orgMgr->getMemberRole($orgIdBin, $user['user_id']);
    if (!in_array($inviterRole, ['OWNER', 'ADMIN'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Insufficient Permissions']);
        exit;
    }

    // HF-60.2: AbuseGuard
    require_once __DIR__ . '/../../../includes/abuse_guard.php';
    $abuseGuard = new AbuseGuard($pdo);
    $abuseGuard->checkInviteQuota($orgIdBin, $user['user_id']);

    // HF-60.3: Domain Policy
    $org = $orgMgr->getOrgById($orgIdBin); // Need to implement/expose getOrgById or similar
    // (Mock implementation for now or reusing getOrgBySlug equivalent logic if ID available)
    if (!empty($org['allowed_domains'])) {
        $allowed = json_decode($org['allowed_domains'], true);
        $domain = substr(strrchr($email, "@"), 1);
        if ($allowed && !in_array($domain, $allowed)) {
            http_response_code(403);
            echo json_encode(['error' => "Domain @$domain not allowed by Organization Policy"]);
            exit;
        }
    }

    $inviteMgr = new OrgInviteManager($pdo);
    $token = $inviteMgr->createInvite($orgIdBin, $user['user_id'], $email, $role);

    // In real app, send Email here.
    echo json_encode(['success' => true, 'debug_token' => $token]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
