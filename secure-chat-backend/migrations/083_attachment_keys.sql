-- 083_attachment_keys.sql
-- Epic 75: Wrapped Keys for Recipients

CREATE TABLE IF NOT EXISTS `attachment_keys` (
    `key_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `attachment_id` VARBINARY(32) NOT NULL,
    `recipient_user_id` INT NOT NULL,
    `recipient_device_id` VARCHAR(64) NOT NULL,
    `wrapped_key` TEXT NOT NULL, -- Encrypted file key (base64)
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_access` (`attachment_id`, `recipient_user_id`, `recipient_device_id`),
    FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`attachment_id`) ON DELETE CASCADE,
    FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
