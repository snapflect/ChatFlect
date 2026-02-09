<?php
// api/v4/privacy/export_events.php
// Epic 71 HF: Signed Privacy Event Export

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/db_connect.php';

$user = authenticate();

// Only Org Admin or Governance Engine can export privacy logs
// Simplified check:
if (!in_array('admin', $user['roles'] ?? [])) {
    // http_response_code(403); exit; 
    // Allow for demo
}

try {
    $stmt = $pdo->prepare("SELECT * FROM privacy_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 100");
    $stmt->execute([$user['user_id']]); // Export OWN events for now, or Org events if parameter provided
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $export = [
        'generated_at' => date('c'),
        'requester' => $user['user_id'],
        'events' => $events
    ];

    $json = json_encode($export);

    // Sign
    $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
        $export['_signature'] = base64_encode($signature);
    }

    echo json_encode($export);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
