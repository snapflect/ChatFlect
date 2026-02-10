-- 065_org_policies.sql
-- Epic 62: Organization Policies
-- Stores versioned security configurations for organizations.

CREATE TABLE IF NOT EXISTS `org_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `version` INT NOT NULL DEFAULT 1,
    `policy_json` JSON NOT NULL, -- The rules: { "allow_exports": false, ... }
    `created_by_user_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `is_active` BOOLEAN GENERATED ALWAYS AS (TRUE) VIRTUAL, -- Simplified current pointer or use MAX(version)
    
    INDEX `idx_org_version` (`org_id`, `version`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
