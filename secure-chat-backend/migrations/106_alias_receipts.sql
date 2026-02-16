-- 106_alias_receipts.sql
-- Epic 74 HF: Signed Alias History & Receipts

CREATE TABLE IF NOT EXISTS `alias_history_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `conversation_id` VARBINARY(32) NOT NULL,
    `old_alias` VARCHAR(50),
    `new_alias` VARCHAR(50) NOT NULL,
    `changed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `signature` TEXT NOT NULL, -- Server signature of change event
    
    INDEX `idx_user_conv` (`user_id`, `conversation_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
