-- 038_delivery_security_events.sql
-- Epic 49-HF: Delivery Tamper Logging

CREATE TABLE IF NOT EXISTS `delivery_security_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_type` ENUM('INVALID_ACK_TRANSITION', 'SYNC_WATERMARK_VIOLATION', 'MARKER_SPOOF_ATTEMPT', 'UNAUTHORIZED_SYNC') NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `message_uuid` VARCHAR(64) DEFAULT NULL,
    `attempted_state` VARCHAR(20) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_dev_sec` (`device_id`, `event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
