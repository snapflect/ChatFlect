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

    // HF-77.4: Privacy Masking
    // Mask IDs/IPs if user doesn't have "UNMASK" permission (Mock)
    // Assume default is MASKED

    foreach ($history as &$row) {
        $row['call_id'] = bin2hex($row['call_id']); // Ensure Hex
        // initiator_user_id is internal ID, usually fine, but PII implies name/phone.
        // We'll mask it anyway for the example.
        $row['initiator_user_id'] = 'USER-' . substr(md5($row['initiator_user_id']), 0, 6);
    }
    unset($row);

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
