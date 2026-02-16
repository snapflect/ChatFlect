-- 063_org_invites.sql
-- Epic 60: Organization Invites
-- Helper table for the invitation workflow (security tokens).

CREATE TABLE IF NOT EXISTS `org_invites` (
    `invite_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `invited_email` VARCHAR(255) NOT NULL,
    `invited_by_user_id` VARCHAR(255) NOT NULL,
    `invite_token` CHAR(64) NOT NULL, -- SHA256 of random token
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'AUDITOR') NOT NULL DEFAULT 'MEMBER',
    `expires_at` DATETIME NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED') DEFAULT 'PENDING',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_token` (`invite_token`),
    INDEX `idx_org_email` (`org_id`, `invited_email`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
