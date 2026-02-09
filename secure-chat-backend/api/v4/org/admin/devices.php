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

    $devices = $mgr->getOrgDevices($orgIdBin); // Update manager to accept pagination or slice here

    // HF-61.3: Pagination (Slicing array for now since manager returns all, optimal is SQL limit)
    $limit = isset($_GET['limit']) ? min((int) $_GET['limit'], 100) : 50;
    $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;

    $pagedDevices = array_slice($devices, $offset, $limit);

    echo json_encode(['devices' => $pagedDevices, 'total' => count($devices), 'limit' => $limit, 'offset' => $offset]);

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
