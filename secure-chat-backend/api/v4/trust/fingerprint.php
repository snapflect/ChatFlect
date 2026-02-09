<?php
// api/v4/trust/fingerprint.php
// Epic 72: Get Safety Number

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/verification_manager.php';

$user = authenticate();
$contactId = $_GET['contact_user_id']; // Target User

try {
    // 1. Fetch User Identity Key
    // 2. Fetch Contact Identity Key
    // For MVP, we assume keys are stored in `users` table or `identity_keys` table via KeyManager.
    // Let's mock fetching keys for this logic demo or query DB.

    $stmt = $pdo->prepare("SELECT public_key FROM users WHERE user_id = ?");
    $stmt->execute([$user['user_id']]);
    $myKey = $stmt->fetchColumn();

    $stmt->execute([$contactId]);
    $theirKey = $stmt->fetchColumn();

    if (!$myKey || !$theirKey) {
        throw new Exception("Identity keys missing");
    }

    $mgr = new VerificationManager($pdo);
    $fingerprint = $mgr->getSafetyNumber(hex2bin($myKey), hex2bin($theirKey));

    echo json_encode([
        'fingerprint' => $fingerprint,
        'format' => 'XXXXX XXXXX ...'
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
