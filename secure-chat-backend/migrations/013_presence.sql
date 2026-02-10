-- Migration: 013_presence.sql
-- Epic 19: Presence & Typing Migration (MySQL)

CREATE TABLE IF NOT EXISTS presence (
    user_id VARCHAR(255) NOT NULL,
    device_uuid VARCHAR(64) NOT NULL,
    status ENUM('online', 'offline', 'busy') NOT NULL DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    typing_in_chat VARCHAR(255) NULL,
    app_version VARCHAR(50) NULL,
    
    PRIMARY KEY (user_id, device_uuid),
    INDEX idx_user_last_seen (user_id, last_seen),
    INDEX idx_last_seen (last_seen) -- For global cleanup
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
