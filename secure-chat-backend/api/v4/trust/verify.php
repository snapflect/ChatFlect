<?php
// api/v4/trust/verify.php
// Epic 72: Mark Contact Verified

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/verification_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$contactId = $input['contact_user_id'];
$keyHash = $input['key_hash']; // Checksum of the key seen by client

try {
    // Optional: Validate keyHash matches current server key
    // For now, trust the client's view since THEY are verifying what they see.
    // Server just stores it.

    $mgr = new VerificationManager($pdo);
    $mgr->verifyContact($user['user_id'], $contactId, $keyHash);

    echo json_encode(['success' => true, 'status' => 'VERIFIED']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
