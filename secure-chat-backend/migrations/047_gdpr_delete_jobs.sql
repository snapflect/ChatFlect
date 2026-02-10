-- 047_gdpr_delete_jobs.sql
-- Epic 54 Hardening: GDPR Deletion Job Tracking
-- Ensures reliable tracking of deletion requests and their outcomes.

CREATE TABLE IF NOT EXISTS `gdpr_delete_jobs` (
    `job_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(128) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED') DEFAULT 'PENDING',
    `items_deleted` INT DEFAULT 0,
    `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `finished_at` TIMESTAMP NULL,
    `error_message` TEXT,
    
    INDEX `idx_status` (`status`),
    INDEX `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
