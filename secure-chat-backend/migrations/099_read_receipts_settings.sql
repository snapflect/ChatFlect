-- 099_read_receipts_settings.sql
-- Epic 83: Read Receipts Settings

-- Ensure user_privacy_settings has read_receipts_enabled (Already in 095, but safe to verify)
-- If we need Org Override, we might need a policies table.
-- Mocking Org Policy in Engine for now as requested in Plan, 
-- but let's create a placeholder table for future org policies.

CREATE TABLE IF NOT EXISTS `organization_policies` (
    `policy_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `policy_key` VARCHAR(50) NOT NULL, -- 'READ_RECEIPTS', 'TRAFFIC_PADDING'
    `policy_value` VARCHAR(50) NOT NULL, -- 'FORCE_OFF', 'FORCE_ON', 'HIGH', 'LOW'
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_policy` (`org_id`, `policy_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
