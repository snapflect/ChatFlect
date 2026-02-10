-- 092_tombstones.sql
-- Epic 70 HF: Message Tombstones for Sync

CREATE TABLE IF NOT EXISTS `message_tombstones` (
    `tombstone_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `message_id` BINARY(16) NOT NULL,
    `conversation_id` BINARY(16) NOT NULL,
    `deleted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `reason` ENUM('TTL', 'USER_DELETE', 'ADMIN_DELETE') DEFAULT 'TTL',
    
    INDEX `idx_sync` (`conversation_id`, `deleted_at`),
    UNIQUE KEY `idx_msg` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
