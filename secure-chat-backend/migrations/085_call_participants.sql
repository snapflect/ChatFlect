-- 085_call_participants.sql
-- Epic 76: Call Participants

CREATE TABLE IF NOT EXISTS `call_participants` (
    `participant_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `call_id` VARBINARY(32) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `status` ENUM('INVITED', 'JOINED', 'LEFT', 'REVOKED') DEFAULT 'INVITED',
    `joined_at` TIMESTAMP NULL,
    `left_at` TIMESTAMP NULL,
    
    UNIQUE KEY `uniq_call_device` (`call_id`, `user_id`, `device_id`),
    FOREIGN KEY (`call_id`) REFERENCES `calls`(`call_id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
