-- 073_governance_retention_archive.sql
-- Epic 64 HF: Governance for Retention & Restore

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_UPDATE_RETENTION', 'Update Retention Policy', 1, 'ADMIN'),
('ORG_RESTORE_ARCHIVE', 'Restore Archive Snapshot', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);
