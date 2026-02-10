<?php
// includes/restore_manager.php
// Epic 73: Restore Logic
// HF-73.3: Rate Limiting & HF-73.4 Governance

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/recovery_phrase.php';

class RestoreManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    // HF-73.3: Rate Limit Restore Attempts
    // Max 5 attempts per hour
    public function checkRateLimit($userId)
    {
        // Mock Implementation using Audit Log
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM audit_logs WHERE user_id = ? AND action = 'RESTORE_ATTEMPT' AND created_at > NOW() - INTERVAL 1 HOUR");
        $stmt->execute([$userId]);
        $count = $stmt->fetchColumn();

        return $count < 5;
    }

    public function logAttempt($userId, $success)
    {
        $status = $success ? 'SUCCESS' : 'FAILURE';
        $stmt = $this->pdo->prepare("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'RESTORE_ATTEMPT', ?)");
        $stmt->execute([$userId, $status]);
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
        $stmt = $this->pdo->prepare("SELECT encrypted_data, iv, auth_tag, signature FROM backup_blobs WHERE job_id = ? AND user_id = ?");
        $stmt->execute([$jobId, $userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
