-- 084_feature_flags.sql
-- Epic 68: Feature Flags

CREATE TABLE IF NOT EXISTS `feature_flags` (
    `flag_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `feature_key` VARCHAR(50) NOT NULL, -- e.g., 'SSO', 'EXPORTS'
    `is_enabled` BOOLEAN DEFAULT FALSE,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` INT NULL,
    
    UNIQUE KEY `uk_org_feature` (`org_id`, `feature_key`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
