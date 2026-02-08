-- 027_group_receipts.sql
-- Epic 45: Group Receipts and Reliability Schema

-- Table 1: group_receipts
-- Tracks delivery and read receipts for group messages
CREATE TABLE IF NOT EXISTS `group_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(64) NOT NULL,
    `message_uuid` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `device_uuid` VARCHAR(64) NOT NULL,
    `type` ENUM('DELIVERED', 'READ') NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_receipt` (`message_uuid`, `user_id`, `type`),
    INDEX `idx_group_fetch` (`group_id`, `receipt_id`),
    INDEX `idx_user_stats` (`user_id`, `created_at`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
