-- 098_group_join_requests.sql
-- Epic 82 HF: Join Approvals

CREATE TABLE IF NOT EXISTS `group_join_requests` (
    `request_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(100) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `processed_at` TIMESTAMP NULL,
    `processed_by` VARCHAR(255) NULL,
    
    UNIQUE KEY `uniq_request` (`group_id`, `user_id`, `status`), -- Prevent duplicate pendings
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`processed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
