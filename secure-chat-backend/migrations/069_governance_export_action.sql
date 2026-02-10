-- 069_governance_export_action.sql
-- Epic 63: Governance for Exports

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_EXPORT_COMPLIANCE', 'Generate Compliance Export', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);
