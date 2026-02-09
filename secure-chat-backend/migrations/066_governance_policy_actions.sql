-- 066_governance_policy_actions.sql
-- Epic 62 HF: Policy Governance
-- Adds policy update to governed actions.

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_UPDATE_POLICY', 'Update Organization Security Policy', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);
