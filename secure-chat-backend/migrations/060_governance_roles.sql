-- 060_governance_roles.sql
-- Epic 58 HF 2: Role-Based Governance
-- Adds required_role to policies.

ALTER TABLE `governance_policies`
ADD COLUMN `required_role` ENUM('ANY', 'SECURITY', 'OPS', 'SUPER_ADMIN') DEFAULT 'ANY' AFTER `min_approvers`;

-- Update critical policies
UPDATE `governance_policies` SET `required_role` = 'SECURITY' WHERE `action_type` IN ('PERMA_BAN', 'EXPORT_DATA', 'POLICY_CHANGE');
