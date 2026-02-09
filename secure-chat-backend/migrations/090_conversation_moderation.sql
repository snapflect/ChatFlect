-- 090_conversation_moderation.sql
-- Epic 78: Conversation Moderation State

CREATE TABLE IF NOT EXISTS `conversation_moderation_state` (
    `state_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `conversation_id` VARBINARY(32) NOT NULL,
    `is_frozen` BOOLEAN DEFAULT FALSE,
    `frozen_by_user_id` INT DEFAULT NULL,
    `frozen_at` TIMESTAMP NULL,
    `freeze_reason` VARCHAR(255),
    `legal_hold_active` BOOLEAN DEFAULT FALSE,
    `legal_hold_ref` VARCHAR(100),
    
    UNIQUE KEY `uniq_conv_mod` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
