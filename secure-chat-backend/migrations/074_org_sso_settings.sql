-- 074_org_sso_settings.sql
-- Epic 65: SSO Configuration

CREATE TABLE IF NOT EXISTS `org_sso_settings` (
    `org_id` BINARY(16) NOT NULL PRIMARY KEY,
    `provider_type` ENUM('OIDC', 'SAML') DEFAULT 'OIDC',
    `issuer_url` VARCHAR(255) NOT NULL,
    `client_id` VARCHAR(255) NOT NULL,
    `client_secret` TEXT NOT NULL, -- Encrypted? Ideally yes.
    `allowed_domains` TEXT DEFAULT NULL, -- Comma separated
    `auto_provision` BOOLEAN DEFAULT FALSE,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` VARCHAR(255) NOT NULL,
    
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
