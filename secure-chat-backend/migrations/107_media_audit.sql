-- 107_media_audit.sql
-- Epic 75 HF: Media Audit & Quotas

CREATE TABLE IF NOT EXISTS `media_audit_logs` (
    `log_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `attachment_id` VARBINARY(32),
    `action` ENUM('UPLOAD', 'DOWNLOAD', 'KEY_FETCH', 'DELETE') NOT NULL,
    `details` JSON,
    `ip_address` VARCHAR(45),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_media_audit_user` (`user_id`),
    INDEX `idx_media_audit_attach` (`attachment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attachment_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `attachment_id` VARBINARY(32) NOT NULL,
    `uploader_id` VARCHAR(255) NOT NULL,
    `sha256_hash` VARBINARY(32) NOT NULL,
    `timestamp` BIGINT NOT NULL,
    `signature` TEXT NOT NULL,
    
    UNIQUE KEY `uniq_attach_receipt` (`attachment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
