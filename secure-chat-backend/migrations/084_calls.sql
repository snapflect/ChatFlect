-- 084_calls.sql
-- Epic 76: Call Sessions

CREATE TABLE IF NOT EXISTS `calls` (
    `call_id` VARBINARY(32) PRIMARY KEY, -- Random ID
    `initiator_user_id` INT NOT NULL,
    `status` ENUM('INIT', 'ACTIVE', 'ENDED') DEFAULT 'INIT',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `ended_at` TIMESTAMP NULL,
    `end_reason` VARCHAR(100) DEFAULT NULL,
    
    FOREIGN KEY (`initiator_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
