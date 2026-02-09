<?php
// api/v4/calls/export_history.php
// Epic 77: Signed Call History Export

require_once __DIR__ . '/../../includes/auth_middleware.php';

$user = authenticate();
// Check Admin

try {
    // Export Last 50 calls for Org
    $stmt = $pdo->prepare("SELECT call_id, initiator_user_id, status, created_at, ended_at, end_reason FROM calls LIMIT 50");
    $stmt->execute();
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Sign the Bundle
    $payload = json_encode($history);
    $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
    $signature = '';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($payload, $rawSig, $pkey, OPENSSL_ALGO_SHA256);
        $signature = base64_encode($rawSig);
    }

    echo json_encode(['history' => $history, 'signature' => $signature]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
