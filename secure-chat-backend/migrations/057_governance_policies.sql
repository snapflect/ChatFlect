-- 057_governance_policies.sql
-- Epic 58: Governance Policy Rules
-- Stores configuration for required approvals.

CREATE TABLE IF NOT EXISTS `governance_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `action_type` VARCHAR(50) NOT NULL, -- e.g., 'PERMA_BAN', 'GDPR_DELETE'
    `description` VARCHAR(255) NOT NULL,
    `requires_approval` BOOLEAN DEFAULT TRUE,
    `min_approvers` INT DEFAULT 1, -- Number of additional admins required (1 = requester + 1 approver)
    `auto_expire_hours` INT DEFAULT 24,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `idx_action` (`action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Policies
INSERT INTO `governance_policies` (action_type, description, min_approvers) VALUES
('PERMA_BAN', 'Permanently ban a user', 1),
('GDPR_DELETE', 'Right to Erasure execution', 1),
('DEVICE_REVOKE', 'Force revoke device keys', 1),
('POLICY_CHANGE', 'Modify retention or governance rules', 1),
('EXPORT_DATA', 'Export sensitive user data', 1)
ON DUPLICATE KEY UPDATE description = VALUES(description);
