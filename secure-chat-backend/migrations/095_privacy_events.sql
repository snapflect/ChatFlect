-- 095_privacy_events.sql
-- Epic 71: Screenshot & Recording Events

CREATE TABLE IF NOT EXISTS `privacy_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `conversation_id` BINARY(16) NOT NULL,
    `user_id` INT NOT NULL,
    `device_id` VARCHAR(64) DEFAULT NULL,
    `event_type` ENUM('SCREENSHOT_TAKEN', 'SCREEN_RECORDING_STARTED', 'SCREEN_RECORDING_STOPPED') NOT NULL,
    `platform` VARCHAR(20) DEFAULT NULL, -- ANDROID, IOS, WEB
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_conv` (`conversation_id`),
    INDEX `idx_user` (`user_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
