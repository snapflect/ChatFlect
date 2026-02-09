-- 104_anonymous_profiles.sql
-- Epic 74: Anonymous Profiles per Conversation

CREATE TABLE IF NOT EXISTS `anonymous_profiles` (
    `profile_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `conversation_id` VARBINARY(32) NOT NULL, -- Specific to a conversation
    `alias_name` VARCHAR(50) NOT NULL, -- e.g., "Ghost-91"
    `alias_icon` VARCHAR(255) DEFAULT NULL, -- URL or icon ID
    `is_anonymous` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `unique_user_conv` (`user_id`, `conversation_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
