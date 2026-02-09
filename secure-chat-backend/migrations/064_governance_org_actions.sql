-- 064_governance_org_actions.sql
-- Epic 61 HF: Org Admin Governance Policies
-- Adds policies for destructive Organization actions.

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_REMOVE_MEMBER', 'Remove a member from an Organization', 1, 'ADMIN'),
('ORG_DISABLE_MEMBER', 'Disable an Organization Member', 1, 'ADMIN'),
('ORG_REVOKE_DEVICE', 'Revoke an Organization Device', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);
