<?php
// api/v4/backup/restore.php
// Epic 73: Restore Logic
// HF-73.3: Enforce Rate Limit

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/restore_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $phrase = $input['recovery_phrase'];
    $rm = new RestoreManager($pdo);

    // HF-73.3: Rate Limit
    if (!$rm->checkRateLimit($user['user_id'])) {
        http_response_code(429);
        echo json_encode(['error' => 'Too many restore attempts. Try again later.']);
        exit;
    }

    // Log Attempt Start (Optimistic logging or could log failure only)
    // Here we log failure if validate fails

    if (!$rm->validatePhrase($user['user_id'], $phrase)) {
        $rm->logAttempt($user['user_id'], false);
        throw new Exception("Invalid Recovery Phrase");
    }

    $rm->logAttempt($user['user_id'], true);

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
