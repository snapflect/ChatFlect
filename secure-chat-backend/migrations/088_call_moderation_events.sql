-- 088_call_moderation_events.sql
-- Epic 77: Moderation Logs

CREATE TABLE IF NOT EXISTS `call_moderation_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `call_id` VARBINARY(32) NOT NULL,
    `moderator_user_id` VARCHAR(255) NOT NULL,
    `action` ENUM('FORCE_END', 'KICK_DEVICE', 'FLAG_ABUSE') NOT NULL,
    `target_user_id` VARCHAR(255) DEFAULT NULL,
    `target_device_id` VARCHAR(64) DEFAULT NULL,
    `reason` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `signature` TEXT NOT NULL, -- Signed by server
    
    INDEX `idx_mod_call` (`call_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
