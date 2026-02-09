-- 091_message_forward_events.sql
-- Epic 78: Forwarding Audit

CREATE TABLE IF NOT EXISTS `message_forward_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `source_message_id` VARBINARY(32) NOT NULL,
    `source_conversation_id` VARBINARY(32) NOT NULL,
    `target_conversation_id` VARBINARY(32) NOT NULL,
    `user_id` INT NOT NULL,
    `status` ENUM('ALLOWED', 'BLOCKED') NOT NULL,
    `reason` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_fwd_src` (`source_conversation_id`),
    INDEX `idx_fwd_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
