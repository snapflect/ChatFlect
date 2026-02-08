-- 026_sender_keys.sql
-- Epic 44: Group Sender Keys (Signal Protocol)

-- Table 1: group_sender_keys
-- Stores the encrypted sender key for each recipient device
CREATE TABLE IF NOT EXISTS `group_sender_keys` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(64) NOT NULL,
    `sender_id` VARCHAR(255) NOT NULL,
    `sender_device_uuid` VARCHAR(64) NOT NULL,
    `recipient_id` VARCHAR(255) NOT NULL,
    `recipient_device_uuid` VARCHAR(64) NOT NULL,
    `sender_key_id` BIGINT NOT NULL,
    `encrypted_sender_key` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_recipient_key` (`group_id`, `sender_id`, `recipient_id`, `recipient_device_uuid`),
    INDEX `idx_fetch_keys` (`group_id`, `recipient_id`, `recipient_device_uuid`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: group_sender_key_state
-- Tracks the current version/rotation state of a sender's key
CREATE TABLE IF NOT EXISTS `group_sender_key_state` (
    `group_id` VARCHAR(64) NOT NULL,
    `sender_id` VARCHAR(255) NOT NULL,
    `sender_device_uuid` VARCHAR(64) NOT NULL,
    `sender_key_id` BIGINT NOT NULL,
    `last_rotated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`group_id`, `sender_id`, `sender_device_uuid`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
