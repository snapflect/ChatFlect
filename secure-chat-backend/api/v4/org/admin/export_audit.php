<?php
// api/v4/org/admin/export_audit.php
// Epic 61 HF: Signed Org Audit Export

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';
require_once __DIR__ . '/../../../../includes/env.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']); // Access internal check

    // Fetch Last 1000 Events (Compliance Limit)
    $stmt = $pdo->prepare("
        SELECT log_id, event_type, user_id, resource_id, metadata, created_at, row_hash 
        FROM audit_logs 
        WHERE resource_id = ? 
        ORDER BY log_id DESC LIMIT 1000
    ");
    $stmt->execute([$orgIdHex]);
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $payload = [
        'org_id' => $orgIdHex,
        'exported_at' => date('c'),
        'exported_by' => $user['user_id'],
        'events' => $events
    ];

    // Sign
    $json = json_encode($payload, JSON_PRETTY_PRINT);
    $privateKeyPath = __DIR__ . '/../../../../keys/server_private.pem';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
        $payload['_signature'] = base64_encode($signature);
    } else {
        $payload['_signature'] = 'DEV_MODE_UNSIGNED';
    }

    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="org_audit_signed.json"');
    echo json_encode($payload, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
