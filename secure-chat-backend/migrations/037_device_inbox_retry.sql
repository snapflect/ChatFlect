-- 037_device_inbox_retry.sql
-- Epic 49-HF: Resilience / Active Requeue

ALTER TABLE `device_inbox`
ADD COLUMN `retry_count` INT DEFAULT 0,
ADD COLUMN `last_retry_at` TIMESTAMP NULL DEFAULT NULL;

-- Index for cron job
CREATE INDEX `idx_retry` ON `device_inbox` (`status`, `retry_count`, `created_at`);
