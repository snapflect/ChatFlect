<?php
// api/v4/conversations/export_bundle.php
// Epic 78: Compliance Export

require_once __DIR__ . '/../../includes/auth_middleware.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$convId = $input['conversation_id'];

try {
    // 1. Fetch Metadata (Participants, Created At)
    // 2. Fetch Moderation History
    // 3. Sign Bundle

    $stmt = $pdo->prepare("SELECT * FROM conversation_moderation_state WHERE conversation_id = UNHEX(?)");
    $stmt->execute([$convId]);
    $modState = $stmt->fetch(PDO::FETCH_ASSOC);

    $payload = json_encode(['conversation_id' => $convId, 'moderation_state' => $modState]);

    // Sign
    $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
    $signature = '';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($payload, $rawSig, $pkey, OPENSSL_ALGO_SHA256);
        $signature = base64_encode($rawSig);
    }

    echo json_encode(['bundle' => $payload, 'signature' => $signature]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
