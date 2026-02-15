-- 061_organizations.sql
-- Epic 60: Organization Foundation
-- Stores the identity of an organization (Tenant).

CREATE TABLE IF NOT EXISTS `organizations` (
    `org_id` BINARY(16) NOT NULL PRIMARY KEY, -- UUID
    `org_name` VARCHAR(255) NOT NULL,
    `org_slug` VARCHAR(100) NOT NULL UNIQUE, -- For URL routing (e.g. /org/acme)
    `allowed_domains` TEXT DEFAULT NULL, -- JSON array of allowed email domains for invites
    `created_by_user_id` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_org_slug` (`org_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
