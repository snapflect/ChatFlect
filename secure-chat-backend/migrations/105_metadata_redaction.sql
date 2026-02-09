-- 105_metadata_redaction.sql
-- Epic 74: Metadata Redaction Policies

CREATE TABLE IF NOT EXISTS `redaction_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `field_name` VARCHAR(50) NOT NULL, -- e.g., 'ip_address', 'email'
    `redaction_type` ENUM('MASK', 'REMOVE', 'HASH') DEFAULT 'MASK',
    `replacement_value` VARCHAR(50) DEFAULT '[REDACTED]',
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default policies
INSERT INTO `redaction_policies` (`field_name`, `redaction_type`) VALUES 
('ip_address', 'MASK'),
('email', 'MASK'),
('device_id', 'HASH');
