<?php
// api/v4/backup/create.php
// Epic 73: Trigger Backup Generation

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/backup_manager.php';
require_once __DIR__ . '/../../includes/recovery_phrase.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
// Client provides the "recovery_key" derived from phrase, 
// OR the phrase itself?
// To be "Zero Knowledge", client should provide the KEY.
// But to verify the phrase (if we enforce it), we might need the phrase?
// Let's assume client sends `derived_key` for encryption.
// AND we trust the client knows the phrase.
// Actually, `recovery_phrase.php` has logic to `deriveKey`.
// If we send the phrase, the server derives the key, uses it, and forgets it.
// This is acceptable if TLS is used and server is not logging it.
// Let's stick to: Client sends verify_proof (optional) + derived encryption key?
// Simplest: Client sends `encryption_key` (derived from phrase). Server uses it.

$encKey = hex2bin($input['encryption_key']);

try {
    $bm = new BackupManager($pdo);
    $jobId = $bm->createJob($user['user_id']);

    // In async world, this queues a worker.
    // Here, we do it inline for MVP.
    $bm->generateBackup($jobId, $user['user_id'], $encKey);

    echo json_encode(['success' => true, 'job_id' => $jobId, 'status' => 'COMPLETED']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
