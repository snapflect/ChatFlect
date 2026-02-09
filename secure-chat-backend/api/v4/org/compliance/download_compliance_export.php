<?php
// api/v4/org/compliance/download_compliance_export.php
// Epic 63: Download Completed Export

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$exportIdHex = $_GET['export_id'] ?? '';

try {
    $exportIdBin = hex2bin($exportIdHex);

    // Retrieve Info
    $stmt = $pdo->prepare("SELECT * FROM compliance_exports WHERE export_id = ?");
    $stmt->execute([$exportIdBin]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$job)
        throw new Exception("Export not found");

    // Check Access
    $adminMgr = new OrgAdminManager($pdo);
    $adminMgr->ensureAdmin($job['org_id'], $user['user_id']);

    if ($job['status'] !== 'COMPLETED') {
        throw new Exception("Export not ready (Status: " . $job['status'] . ")");
    }

    if (!file_exists($job['file_path']))
        throw new Exception("Export file missing");

    // Serve File
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="ORG-COMPLIANCE-' . $job['org_id'] . '.zip"');
    header('Content-Length: ' . filesize($job['file_path']));
    readfile($job['file_path']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
