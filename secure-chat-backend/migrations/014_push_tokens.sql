-- Migration: 014_push_tokens.sql
-- Epic 20: Push Notifications Table (MySQL)

CREATE TABLE IF NOT EXISTS push_tokens (
    user_id VARCHAR(255) NOT NULL,
    device_uuid VARCHAR(64) NOT NULL,
    token TEXT NOT NULL,
    platform ENUM('android', 'ios', 'web') NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Security & Stability Attributes
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=Active, 0=Revoked/Failed',
    last_error TEXT NULL COMMENT 'FCM error message details',
    last_sent_at TIMESTAMP NULL COMMENT 'Rate limiting timestamp',

    PRIMARY KEY (user_id, device_uuid),
    INDEX idx_user_active (user_id, is_active),
    INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
