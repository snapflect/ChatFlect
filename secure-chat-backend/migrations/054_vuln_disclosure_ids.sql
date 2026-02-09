-- 054_vuln_disclosure_ids.sql
-- Epic 57: Vulnerability Disclosure IDs
-- Adds support for assigning "CHATFLECT-YYYY-NNN" IDs to accepted reports.

ALTER TABLE `vulnerability_reports`
ADD COLUMN `disclosure_id` VARCHAR(32) DEFAULT NULL AFTER `status`,
ADD UNIQUE KEY `idx_disclosure_id` (`disclosure_id`);
