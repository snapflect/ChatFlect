-- 091_message_expiry_queue.sql
-- Epic 70: Message Expiry Queue

CREATE TABLE IF NOT EXISTS `message_expiry_queue` (
    `message_id` BINARY(16) NOT NULL PRIMARY KEY,
    `conversation_id` BINARY(16) NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `status` ENUM('PENDING', 'PROCESSED', 'FAILED', 'HELD') DEFAULT 'PENDING',
    
    INDEX `idx_expiry` (`expires_at`, `status`),
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON DELETE CASCADE
    -- message_id FK usually implies messages table, but that might be partitioned.
    -- Strict FK ideal but queue might outlive message if deletion fails.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
