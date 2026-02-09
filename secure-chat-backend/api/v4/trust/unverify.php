<?php
// api/v4/trust/unverify.php
// Epic 72: Revoke Verification

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/verification_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$contactId = $input['contact_user_id'];

try {
    $mgr = new VerificationManager($pdo);
    $mgr->unverifyContact($user['user_id'], $contactId);

    echo json_encode(['success' => true, 'status' => 'UNVERIFIED']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
