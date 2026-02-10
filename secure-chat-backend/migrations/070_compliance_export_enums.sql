-- 070_compliance_export_enums.sql
-- Epic 63 HF: Enhanced Enums for Export Status

ALTER TABLE `compliance_exports` 
MODIFY COLUMN `status` ENUM('PENDING', 'APPROVED', 'GENERATING', 'READY', 'FAILED', 'EXPIRED') DEFAULT 'PENDING';

-- Add Redaction Flag
ALTER TABLE `compliance_exports`
ADD COLUMN `redaction_level` ENUM('NONE', 'PARTIAL', 'STRICT') DEFAULT 'PARTIAL';
