<?php
// includes/backup_manager.php
// Epic 73: Backup Lifecycle
// HF-73.2: Signed Backups

require_once __DIR__ . '/db_connect.php';

class BackupManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function createJob($userId)
    {
        $stmt = $this->pdo->prepare("INSERT INTO backup_jobs (user_id, status, expires_at) VALUES (?, 'PENDING', DATE_ADD(NOW(), INTERVAL 30 DAY))");
        $stmt->execute([$userId]);
        return $this->pdo->lastInsertId();
    }

    public function generateBackup($jobId, $userId, $encryptionKey)
    {
        // Mock Backup Generation
        $backupData = json_encode([
            'metadata' => ['generated_at' => time(), 'version' => '1.0'],
            'vault_items' => [],
            'messages' => []
        ]);

        // Encrypt (AES-256-GCM)
        $iv = random_bytes(12);
        $tag = '';
        $encrypted = openssl_encrypt($backupData, 'aes-256-gcm', $encryptionKey, OPENSSL_RAW_DATA, $iv, $tag);

        // HF-73.2: Sign the Backup Blob
        // Payload to sign: hash(encrypted_data + iv + auth_tag)
        $sigPayload = hash('sha256', $encrypted . $iv . $tag, true);
        $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
        $signature = null;

        if (file_exists($privateKeyPath)) {
            $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
            openssl_sign($sigPayload, $rawSig, $pkey, OPENSSL_ALGO_SHA256);
            $signature = base64_encode($rawSig);
        }

        // Store
        $stmt = $this->pdo->prepare("INSERT INTO backup_blobs (job_id, user_id, encrypted_data, iv, auth_tag, signature, schema_version) VALUES (?, ?, ?, ?, ?, ?, 1)");
        $stmt->execute([$jobId, $userId, $encrypted, $iv, $tag, $signature]);

        // Update Job
        $stmt = $this->pdo->prepare("UPDATE backup_jobs SET status='COMPLETED', backup_size_bytes = ? WHERE job_id = ?");
        $stmt->execute([strlen($encrypted), $jobId]);
    }
}
