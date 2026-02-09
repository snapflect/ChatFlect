<?php
// api/v4/backup/restore.php
// Epic 73: Restore Logic (Signal Metadata mostly, actual blob decryption on client)

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/restore_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    // Validate Phrase Hash (Requires Phrase)
    // Client sends phrase. Server hashes it. compares to DB.
    // If valid, server allows access to backups?
    // Actually, `download.php` allows download if authenticated.
    // `restore.php` might be "I am a new device, help me get the backup".
    // AND "Here is the phrase to prove I am the owner".

    $phrase = $input['recovery_phrase'];
    $rm = new RestoreManager($pdo);

    // Verify Phrase
    $rm->validatePhrase($user['user_id'], $phrase);

    // Check if backup exists
    $backup = $rm->getLatestBackup($user['user_id']);
    if (!$backup) {
        throw new Exception("No valid backups found");
    }

    echo json_encode(['success' => true, 'latest_job_id' => $backup['job_id']]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
