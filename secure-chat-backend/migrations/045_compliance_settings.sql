-- 045_compliance_settings.sql
-- Epic 54: Compliance Configuration & Retention Rules
-- Stores global governance policies.

CREATE TABLE IF NOT EXISTS `compliance_settings` (
    `setting_key` VARCHAR(64) PRIMARY KEY,
    `setting_value` VARCHAR(255) NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` VARCHAR(64) DEFAULT 'SYSTEM'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Defaults
INSERT IGNORE INTO `compliance_settings` (`setting_key`, `setting_value`) VALUES
('compliance_mode', 'STANDARD'), -- STANDARD, STRICT, REGULATED
('retention_audit_logs_days', '365'),
('retention_messages_days', '30'),
('retention_abuse_scores_days', '90'),
('retention_inactive_devices_days', '180');
