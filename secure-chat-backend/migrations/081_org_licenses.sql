-- 081_org_licenses.sql
-- Epic 67: Organization Licenses

CREATE TABLE IF NOT EXISTS `org_licenses` (
    `org_id` BINARY(16) NOT NULL PRIMARY KEY,
    `plan_id` VARCHAR(50) NOT NULL DEFAULT 'FREE', -- FREE, PRO, ENTERPRISE
    `seat_limit` INT NOT NULL DEFAULT 5,
    `subscription_status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') DEFAULT 'ACTIVE',
    `expires_at` TIMESTAMP NULL,
    `features` JSON NULL, -- Cache of enabled features for fast lookup
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
