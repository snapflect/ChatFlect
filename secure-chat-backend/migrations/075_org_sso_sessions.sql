-- 075_org_sso_sessions.sql
-- Epic 65: SSO Sessions / Nonce

CREATE TABLE IF NOT EXISTS `org_sso_states` (
    `state_token` VARCHAR(64) NOT NULL PRIMARY KEY, -- Nonce/State
    `org_id` BINARY(16) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NOT NULL,
    `status` ENUM('PENDING', 'CONSUMED', 'EXPIRED') DEFAULT 'PENDING',
    
    INDEX `idx_exp` (`expires_at`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
