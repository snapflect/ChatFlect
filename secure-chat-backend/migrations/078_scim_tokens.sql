-- 078_scim_tokens.sql
-- Epic 66: SCIM Tokens

CREATE TABLE IF NOT EXISTS `scim_tokens` (
    `token_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL, -- SHA-256 hash of Bearer token
    `description` VARCHAR(255) DEFAULT 'SCIM Token',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `last_used_at` TIMESTAMP NULL,
    `revoked` BOOLEAN DEFAULT FALSE,
    `created_by` INT NOT NULL,
    
    INDEX `idx_org` (`org_id`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
