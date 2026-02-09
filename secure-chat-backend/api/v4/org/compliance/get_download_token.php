<?php
// api/v4/org/compliance/get_download_token.php
// Epic 63 HF: Signed Download Tokens

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/jwt_helper.php'; // Helper we created earlier? Or standard JWT

$user = authenticate();
$exportIdHex = $_GET['export_id'] ?? '';

try {
    $exportIdBin = hex2bin($exportIdHex);
    $stmt = $pdo->prepare("SELECT * FROM compliance_exports WHERE export_id = ?");
    $stmt->execute([$exportIdBin]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);

    // Auth Check
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($job['org_id'], $user['user_id']);

    if ($job['status'] !== 'READY')
        throw new Exception("Export not ready");

    // Generate Short-lived Token (5 mins)
    $payload = [
        'sub' => $user['user_id'],
        'exp' => time() + 300,
        'action' => 'DOWNLOAD_EXPORT',
        'export_id' => $exportIdHex
    ];
    $token = generate_jwt($payload); // Assumes helper function

    echo json_encode(['token' => $token, 'expires_in' => 300]);

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
