-- 096_privacy_settings.sql
-- Epic 71: Screen Shield Settings

-- Add column to conversations table if possible, or separate settings table.
-- Using separate table for cleanliness/extensibility.

CREATE TABLE IF NOT EXISTS `conversation_privacy_settings` (
    `conversation_id` BINARY(16) NOT NULL PRIMARY KEY,
    `shield_mode` BOOLEAN DEFAULT FALSE, -- Block Screenshots/Blur
    `alert_on_screenshot` BOOLEAN DEFAULT TRUE,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` INT NULL,
    
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
