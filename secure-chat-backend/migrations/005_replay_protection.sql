-- Migration: 005_replay_protection.sql
-- Goal: Add table to track message nonces for Replay Protection

CREATE TABLE IF NOT EXISTS `message_replay_log` (
    `message_id` VARCHAR(128) NOT NULL,
    `sender_id` VARCHAR(255) NOT NULL,
    `device_uuid` VARCHAR(64) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`message_id`),
    INDEX `idx_sender_created` (`sender_id`, `created_at`),
    INDEX `idx_cleanup_created` (`created_at`) -- for periodic cleanup of old logs
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
