-- 029_device_events.sql
-- Epic 48: Device Audit Log for Sync Reliability

CREATE TABLE IF NOT EXISTS `device_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `event_type` ENUM('REGISTERED', 'APPROVED', 'REVOKED', 'KEY_ROTATED') NOT NULL,
    `metadata` JSON DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sync` (`user_id`, `event_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
