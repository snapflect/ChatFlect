-- 044_ip_banlist.sql
-- Epic 52: Global Ban List
-- Stores IPs or User IDs that are temporarily or permanently banned.

CREATE TABLE IF NOT EXISTS `ip_banlist` (
    `ban_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `target_type` ENUM('IP', 'USER', 'DEVICE') NOT NULL,
    `target_value` VARCHAR(128) NOT NULL,
    `reason` VARCHAR(255) DEFAULT 'ABUSE_DETECTED',
    `banned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL, -- NULL = Permanent
    `created_by` VARCHAR(64) DEFAULT 'SYSTEM', -- 'SYSTEM' or Admin ID
    
    INDEX `idx_target` (`target_type`, `target_value`),
    INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
