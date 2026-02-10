-- 080_scim_hardening.sql
-- Epic 66 HF: SCIM Hardening

-- 1. Token Hardening
ALTER TABLE `scim_tokens`
ADD COLUMN `expires_at` TIMESTAMP NULL,
ADD COLUMN `allowed_ips` TEXT NULL; -- CIDR list

-- 2. Governance for SCIM
INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_MANAGE_SCIM_TOKEN', 'Create or Revoke SCIM Token', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);
