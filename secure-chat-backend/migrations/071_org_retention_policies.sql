-- 071_org_retention_policies.sql
-- Epic 64: Organization Retention Overrides

CREATE TABLE IF NOT EXISTS `org_retention_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `item_type` VARCHAR(50) NOT NULL, -- 'audit_log', 'chat_message', 'file', 'compliance_export'
    `retention_days` INT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` VARCHAR(255) NOT NULL,
    
    UNIQUE KEY `idx_org_item` (`org_id`, `item_type`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
