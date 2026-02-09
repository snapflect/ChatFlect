-- 076_governance_sso.sql
-- Epic 65 HF: Governance for SSO

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_UPDATE_SSO_CONFIG', 'Update SSO Configuration', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);
