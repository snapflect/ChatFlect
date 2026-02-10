-- 036_device_sync_watermarks.sql
-- Epic 49-HF: Sync Replay Guard

CREATE TABLE IF NOT EXISTS `device_sync_watermarks` (
    `watermark_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `device_id` VARCHAR(64) NOT NULL,
    `conversation_id` VARCHAR(64) NOT NULL, -- Optional if syncing globally vs per-conv
    `last_synced_inbox_id` BIGINT NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_dev_conv` (`device_id`, `conversation_id`),
    FOREIGN KEY (`device_id`) REFERENCES `devices`(`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
