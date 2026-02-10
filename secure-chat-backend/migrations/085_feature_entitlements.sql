-- 085_feature_entitlements.sql
-- Epic 68: Feature Entitlements (Plan Mapping)

CREATE TABLE IF NOT EXISTS `feature_entitlements` (
    `plan_id` VARCHAR(50) NOT NULL,
    `feature_key` VARCHAR(50) NOT NULL,
    `is_allowed` BOOLEAN DEFAULT TRUE,
    
    PRIMARY KEY (`plan_id`, `feature_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data (Initial Defaults)
INSERT IGNORE INTO `feature_entitlements` (`plan_id`, `feature_key`, `is_allowed`) VALUES
('FREE', 'BASIC_CHAT', TRUE),
('FREE', 'SSO', FALSE),
('FREE', 'EXPORTS', FALSE),
('PRO', 'BASIC_CHAT', TRUE),
('PRO', 'SSO', FALSE),
('PRO', 'EXPORTS', TRUE),
('ENTERPRISE', 'BASIC_CHAT', TRUE),
('ENTERPRISE', 'SSO', TRUE),
('ENTERPRISE', 'EXPORTS', TRUE);
