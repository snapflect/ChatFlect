-- 101_backup_jobs.sql
-- Epic 73: Backup Job Lifecycle

CREATE TABLE IF NOT EXISTS `backup_jobs` (
    `job_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    `file_path` VARCHAR(255) DEFAULT NULL, -- Path to blob if strictly local, or ref ID
    `backup_size_bytes` BIGINT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL,
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
