<?php
// api/v4/trust/key_change_status.php
// Epic 72: Poll for Key Changes

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/verification_manager.php';

$user = authenticate();
$contactId = $_GET['contact_user_id'];
$clientSeenHash = $_GET['current_key_hash'];

try {
    $mgr = new VerificationManager($pdo);
    $status = $mgr->checkStatus($user['user_id'], $contactId, $clientSeenHash);

    echo json_encode(['status' => $status]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
