-- 003_conversations_table.sql
-- Epic 3: Core Conversation Entity
-- Missing from original migration set, added to fix FK errors.

CREATE TABLE IF NOT EXISTS `conversations` (
    `conversation_id` VARBINARY(32) NOT NULL PRIMARY KEY,
    `type` ENUM('DIRECT', 'GROUP') NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Optional: Linked Group ID if Type=GROUP
    `group_id` VARCHAR(100) DEFAULT NULL,
    INDEX `idx_type` (`type`),
    INDEX `idx_group` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
