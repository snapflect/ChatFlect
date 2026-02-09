<?php
// api/v4/org/admin/devices.php
// Epic 61: List Org Devices

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']);

    $devices = $mgr->getOrgDevices($orgIdBin);

    echo json_encode(['devices' => $devices]);

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
