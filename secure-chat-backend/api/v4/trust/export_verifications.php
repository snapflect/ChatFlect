<?php
// api/v4/trust/export_verifications.php
// Epic 72 HF: Verification Audit Export

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/db_connect.php';

$user = authenticate();

try {
    $stmt = $pdo->prepare("
        SELECT cv.contact_user_id, cv.status, cv.verified_at, vr.signature, vr.key_hash
        FROM contact_verifications cv
        LEFT JOIN verification_receipts vr ON cv.user_id = vr.user_id AND cv.contact_user_id = vr.contact_user_id
        WHERE cv.user_id = ?
    ");
    $stmt->execute([$user['user_id']]);
    $verifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $export = [
        'generated_at' => date('c'),
        'user_id' => $user['user_id'],
        'verifications' => $verifications
    ];

    $json = json_encode($export);

    // Sign the whole bundle
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
