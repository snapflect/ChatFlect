-- 089_org_message_policies.sql
-- Epic 78: Org Messaging Policies

CREATE TABLE IF NOT EXISTS `org_message_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `allow_external_contacts` BOOLEAN DEFAULT TRUE,
    `allow_media` BOOLEAN DEFAULT TRUE,
    `allow_forwarding` BOOLEAN DEFAULT TRUE,
    `data_retention_days` INT DEFAULT 365, -- Default 1 year
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_org_msg_policy` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
