-- 025_group_messages.sql
-- Epic 42: Group Messaging Transport

-- Table 1: group_messages
CREATE TABLE IF NOT EXISTS `group_messages` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(64) NOT NULL,
    `message_uuid` VARCHAR(64) NOT NULL UNIQUE,
    `sender_id` VARCHAR(255) NOT NULL,
    `sender_device_uuid` VARCHAR(64) NOT NULL,
    `server_seq` BIGINT NOT NULL,
    `encrypted_payload` LONGTEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_group_seq` (`group_id`, `server_seq`),
    INDEX `idx_group_seq` (`group_id`, `server_seq`),
    INDEX `idx_sender` (`sender_id`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: group_sequences (for strict ordering)
CREATE TABLE IF NOT EXISTS `group_sequences` (
    `group_id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `last_seq` BIGINT DEFAULT 0,
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize sequences for existing groups
INSERT IGNORE INTO group_sequences (group_id, last_seq)
SELECT group_id, 0 FROM `groups` WHERE is_active = 1;
