-- 034_device_inbox_state_machine.sql
-- Epic 49: Device Delivery State Machine

-- Enforce strict state transitions (Schema-level where possible, mostly App-level)
-- But we can optimize the index key for state lookups

ALTER TABLE `device_inbox`
MODIFY COLUMN `status` ENUM('PENDING', 'DELIVERED', 'ACKED', 'READ', 'FAILED') DEFAULT 'PENDING';

-- High-performance index for aggregation
CREATE INDEX `idx_message_status` ON `device_inbox` (`message_uuid`, `status`);
