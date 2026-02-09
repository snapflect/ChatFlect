<?php
// api/v4/org/export_members.php
// Epic 60 HF: Signed Member Export

require_once __DIR__ . '/../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../includes/org_manager.php';
require_once __DIR__ . '/../../../includes/env.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $mgr = new OrgManager($pdo);
    $orgIdBin = hex2bin($orgIdHex);

    // Check Permission (Admin+)
    $role = $mgr->getMemberRole($orgIdBin, $user['user_id']);
    if (!in_array($role, ['OWNER', 'ADMIN', 'AUDITOR'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Insufficient Permissions']);
        exit;
    }

    // Fetch Full Roster
    $stmt = $pdo->prepare("
        SELECT u.username, u.email, m.role, m.joined_at, m.status 
        FROM org_members m 
        JOIN users u ON m.user_id = u.id 
        WHERE m.org_id = ?
    ");
    $stmt->execute([$orgIdBin]);
    $roster = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $payload = [
        'org_id' => $orgIdHex,
        'exported_at' => date('c'),
        'exported_by' => $user['user_id'],
        'roster' => $roster
    ];

    // Sign It
    $json = json_encode($payload, JSON_PRETTY_PRINT);
    $privateKeyPath = __DIR__ . '/../../../keys/server_private.pem';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
        $payload['_signature'] = base64_encode($signature);
    } else {
        $payload['_signature'] = 'DEV_MODE_UNSIGNED';
    }

    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="org_roster_signed.json"');
    echo json_encode($payload, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
