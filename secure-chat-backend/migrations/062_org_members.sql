-- 062_org_members.sql
-- Epic 60: Organization Members
-- Links Users to Organizations with a specific Role.

CREATE TABLE IF NOT EXISTS `org_members` (
    `org_id` BINARY(16) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'AUDITOR') NOT NULL DEFAULT 'MEMBER',
    `status` ENUM('ACTIVE', 'DISABLED') DEFAULT 'ACTIVE',
    `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`org_id`, `user_id`), -- Unique constraint: User can only be in an Org once
    INDEX `idx_user_orgs` (`user_id`), -- For "List my orgs"
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
    -- User FK omitted to decouple from legacy user table differences, handled in app logic usually
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
