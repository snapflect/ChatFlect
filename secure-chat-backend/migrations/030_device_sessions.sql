-- 030_device_sessions.sql
-- Epic 48: Per-Device Pairwise Sessions

CREATE TABLE IF NOT EXISTS `device_sessions` (
    `session_id` VARCHAR(128) NOT NULL PRIMARY KEY, -- Derived from sender_dev + recipient_dev
    `sender_user_id` VARCHAR(255) NOT NULL,
    `sender_device_id` VARCHAR(64) NOT NULL,
    `recipient_user_id` VARCHAR(255) NOT NULL,
    `recipient_device_id` VARCHAR(64) NOT NULL,
    `chain_state_json` TEXT NOT NULL, -- Encrypted state blob
    `last_active_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sender_lookup` (`sender_device_id`, `recipient_user_id`),
    INDEX `idx_recipient_lookup` (`recipient_device_id`, `sender_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
