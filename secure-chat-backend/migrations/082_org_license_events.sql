-- 082_org_license_events.sql
-- Epic 67: License Audit Events

CREATE TABLE IF NOT EXISTS `org_license_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `event_type` VARCHAR(50) NOT NULL, -- UPGRADE, DOWNGRADE, EXPIRE
    `old_plan` VARCHAR(50) NULL,
    `new_plan` VARCHAR(50) NULL,
    `performed_by` INT NULL, -- NULL if system action
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_org` (`org_id`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
