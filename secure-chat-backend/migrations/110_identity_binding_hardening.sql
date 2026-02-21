-- Migration 110: HF-5D.4 / 5D.5 / 5D.7 Identity Binding Hardening
-- Phase 5D Extended: Dedup, Anti-Replay, Ownership
-- Run this BEFORE deploying the updated send.php

-- 1. Add sender_device_uuid column to messages for triple-key dedup (HF-5D.4)
ALTER TABLE messages ADD COLUMN sender_device_uuid VARCHAR(64) DEFAULT NULL AFTER sender_id;

-- 2. Composite unique index for strict dedup enforcement (HF-5D.4)
-- Prevents replay: same (sender, device, message_uuid) is rejected
ALTER TABLE messages ADD UNIQUE INDEX idx_msg_sender_dedup (sender_id, sender_device_uuid, message_uuid);

-- 3. Security Events table for incident logging (HF-5D.7)
CREATE TABLE IF NOT EXISTS security_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,        -- DEVICE_SPOOF, MISROUTE_ATTEMPT, REPLAY_BLOCKED, SESSION_LOCKDOWN
    user_id VARCHAR(128) NOT NULL,
    device_uuid VARCHAR(64) DEFAULT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sec_event_type (event_type),
    INDEX idx_sec_user (user_id),
    INDEX idx_sec_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
