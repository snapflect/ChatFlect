<?php
// includes/restore_manager.php
// Epic 73: Restore Logic

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/recovery_phrase.php';

class RestoreManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function validatePhrase($userId, $phrase)
    {
        $rpm = new RecoveryPhraseManager($this->pdo);
        if (!$rpm->verifyPhrase($userId, $phrase)) {
            throw new Exception("Invalid Recovery Phrase");
        }
        return true;
    }

    public function getLatestBackup($userId)
    {
        $stmt = $this->pdo->prepare("SELECT job_id, created_at FROM backup_jobs WHERE user_id = ? AND status='COMPLETED' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getBackupBlob($jobId, $userId)
    {
        $stmt = $this->pdo->prepare("SELECT encrypted_data, iv, auth_tag FROM backup_blobs WHERE job_id = ? AND user_id = ?");
        $stmt->execute([$jobId, $userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
