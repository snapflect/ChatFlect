-- 099_verification_receipts.sql
-- Epic 72 HF: Signed Verification Receipts

CREATE TABLE IF NOT EXISTS `verification_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `contact_user_id` VARCHAR(255) NOT NULL,
    `key_hash` VARCHAR(64) NOT NULL,
    `verified_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `signature` TEXT NOT NULL, -- Server signature of the event
    
    INDEX `idx_user` (`user_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
