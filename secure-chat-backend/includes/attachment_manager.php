<?php
// includes/attachment_manager.php
// Epic 75: Attachment Lifecycle Logic

require_once __DIR__ . '/db_connect.php';

class AttachmentManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function createMetadata($userId, $attachmentId, $size, $mime, $hash)
    {
        $attachmentIdBin = hex2bin($attachmentId);
        $hashBin = hex2bin($hash);

        $stmt = $this->pdo->prepare("INSERT INTO attachments (attachment_id, owner_user_id, encrypted_size_bytes, mime_type, sha256_hash, status, expires_at) VALUES (?, ?, ?, ?, ?, 'STORED', DATE_ADD(NOW(), INTERVAL 7 DAY))");
        $stmt->execute([$attachmentIdBin, $userId, $size, $mime, $hashBin]);
    }

    public function storeWrappedKey($attachmentId, $recipientId, $deviceId, $wrappedKey)
    {
        $attachmentIdBin = hex2bin($attachmentId);
        $stmt = $this->pdo->prepare("INSERT INTO attachment_keys (attachment_id, recipient_user_id, recipient_device_id, wrapped_key) VALUES (?, ?, ?, ?)");
        $stmt->execute([$attachmentIdBin, $recipientId, $deviceId, $wrappedKey]);
    }

    public function getWrappedKey($attachmentId, $userId, $deviceId)
    {
        $attachmentIdBin = hex2bin($attachmentId);
        $stmt = $this->pdo->prepare("SELECT wrapped_key FROM attachment_keys WHERE attachment_id = ? AND recipient_user_id = ? AND recipient_device_id = ?");
        $stmt->execute([$attachmentIdBin, $userId, $deviceId]);
        return $stmt->fetchColumn();
    }

    public function verifyAccess($attachmentId, $userId)
    {
        $attachmentIdBin = hex2bin($attachmentId);
        // Check if owner
        $stmt = $this->pdo->prepare("SELECT 1 FROM attachments WHERE attachment_id = ? AND owner_user_id = ?");
        $stmt->execute([$attachmentIdBin, $userId]);
        if ($stmt->fetchColumn())
            return true;

        // Check if recipient key exists
        $stmt = $this->pdo->prepare("SELECT 1 FROM attachment_keys WHERE attachment_id = ? AND recipient_user_id = ?");
        $stmt->execute([$attachmentIdBin, $userId]);
        return (bool) $stmt->fetchColumn();
    }
}
