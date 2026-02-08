-- 033_device_inbox_retention.sql
-- Epic 48-HF: Hardening - Retention Policy

-- Add expiration column to enable TTL cleanup
ALTER TABLE `device_inbox`
ADD COLUMN `expires_at` BIGINT NULL DEFAULT NULL;

-- Index for efficient cleanup
CREATE INDEX `idx_inbox_cleanup` ON `device_inbox` (`expires_at`);
