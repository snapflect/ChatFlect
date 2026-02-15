-- 082_attachments.sql
-- Epic 75: Attachment Metadata

CREATE TABLE IF NOT EXISTS `attachments` (
    `attachment_id` VARBINARY(32) PRIMARY KEY, -- Random ID
    `owner_user_id` VARCHAR(255) NOT NULL,
    `encrypted_size_bytes` BIGINT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `sha256_hash` VARBINARY(32) NOT NULL, -- Integrity Check
    `status` ENUM('PENDING', 'STORED', 'EXPIRED') DEFAULT 'PENDING',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL,
    
    FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
