-- 093_deletion_receipts.sql
-- Epic 70 HF: Permanent Deletion Receipts

CREATE TABLE IF NOT EXISTS `deletion_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `message_id` BINARY(16) NOT NULL,
    `conversation_id` BINARY(16) NOT NULL,
    `deleted_at` TIMESTAMP NOT NULL,
    `reason` VARCHAR(50) NOT NULL,
    `receipt_signature` TEXT NOT NULL, -- Base64 encoded signature
    
    INDEX `idx_conv` (`conversation_id`),
    INDEX `idx_msg` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
