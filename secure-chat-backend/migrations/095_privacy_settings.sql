-- 095_privacy_settings.sql
-- Epic 81: Privacy Settings Metadata

CREATE TABLE IF NOT EXISTS `user_privacy_settings` (
    `user_id` VARCHAR(255) NOT NULL PRIMARY KEY,
    
    -- Visibility Rules: 'everyone', 'contacts', 'nobody', 'except'
    `last_seen_visibility` ENUM('everyone', 'contacts', 'nobody') DEFAULT 'contacts',
    `profile_photo_visibility` ENUM('everyone', 'contacts', 'nobody') DEFAULT 'contacts',
    `about_visibility` ENUM('everyone', 'contacts', 'nobody') DEFAULT 'contacts',
    
    `read_receipts_enabled` BOOLEAN DEFAULT TRUE,
    
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exceptions table for 'My Contacts Except...'
CREATE TABLE IF NOT EXISTS `privacy_exceptions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `blocked_viewer_id` VARCHAR(255) NOT NULL, -- The contact who is EXCLUDED from seeing
    `setting_type` ENUM('last_seen', 'profile_photo', 'about') NOT NULL,
    
    UNIQUE KEY `uniq_exception` (`user_id`, `blocked_viewer_id`, `setting_type`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
