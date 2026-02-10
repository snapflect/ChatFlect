-- 102_backup_blobs.sql
-- Epic 73: Encrypted Backup Blobs

CREATE TABLE IF NOT EXISTS `backup_blobs` (
    `blob_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `job_id` BIGINT NOT NULL,
    `user_id` INT NOT NULL,
    `encrypted_data` LONGBLOB, -- The actual encrypted bundle
    `iv` BINARY(12) NOT NULL, -- AES-GCM IV
    `auth_tag` BINARY(16) NOT NULL, -- AES-GCM Auth Tag
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`job_id`) REFERENCES `backup_jobs`(`job_id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
