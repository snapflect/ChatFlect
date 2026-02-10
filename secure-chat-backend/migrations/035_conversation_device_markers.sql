-- 035_conversation_device_markers.sql
-- Epic 49: Read Receipt Convergence

CREATE TABLE IF NOT EXISTS `conversation_device_markers` (
    `marker_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `conversation_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL, -- The user who read
    `device_id` VARCHAR(64) NOT NULL, -- The specific device that updated it
    `last_read_message_id` VARCHAR(64) DEFAULT NULL,
    `last_delivered_message_id` VARCHAR(64) DEFAULT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_conv_device` (`conversation_id`, `device_id`),
    INDEX `idx_user_conv` (`user_id`, `conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
