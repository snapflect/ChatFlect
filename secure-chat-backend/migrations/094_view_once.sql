-- 094_view_once.sql
-- Epic 80: View Once Metadata

ALTER TABLE `messages` 
ADD COLUMN `message_type_old` VARCHAR(50) DEFAULT 'text', -- Preserve old if needed or just use existing
MODIFY COLUMN `message_type` VARCHAR(50) NOT NULL; 

-- Or better, just add a flag if type is already generic
ALTER TABLE `messages`
ADD COLUMN `is_view_once` BOOLEAN DEFAULT FALSE,
ADD COLUMN `viewed_at` TIMESTAMP NULL DEFAULT NULL;

-- Index for cleanup
CREATE INDEX `idx_view_once_pending` ON `messages` (`is_view_once`, `viewed_at`);
