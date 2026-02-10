-- 056_vuln_file_hash.sql
-- Epic 57: File Deduplication Hash
-- Stores SHA256 of the *file content* to detect identical uploads.

ALTER TABLE `vulnerability_attachments`
ADD COLUMN `file_hash` CHAR(64) NOT NULL AFTER `filename_original`,
ADD INDEX `idx_file_hash` (`file_hash`);
