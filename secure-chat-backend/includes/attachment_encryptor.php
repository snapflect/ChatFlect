<?php
// includes/attachment_encryptor.php
// Epic 75: Server-Side Storage Helper (Does NOT encrypt, just stores blobs)

class AttachmentEncryptor
{
    // Note: Name is slightly misleading as Server DOES NOT encrypt.
    // Client encrypts. This class validates and stores encrypted blobs.

    private $storagePath;

    public function __construct($storagePath)
    {
        $this->storagePath = $storagePath;
        if (!is_dir($storagePath)) {
            mkdir($storagePath, 0750, true);
        }
    }

    public function storeBlob($attachmentId, $blobData)
    {
        // Validate ID format
        if (!preg_match('/^[a-f0-9]{64}$/', $attachmentId)) {
            throw new Exception("Invalid Attachment ID");
        }

        $filePath = $this->storagePath . '/' . $attachmentId . '.bin';

        if (file_put_contents($filePath, $blobData) === false) {
            throw new Exception("Failed to write blob storage");
        }

        return $filePath;
    }

    public function getBlobPath($attachmentId)
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $attachmentId)) {
            throw new Exception("Invalid Attachment ID");
        }
        $filePath = $this->storagePath . '/' . $attachmentId . '.bin';
        if (!file_exists($filePath)) {
            throw new Exception("Attachment not found on disk");
        }
        return $filePath;
    }
}
