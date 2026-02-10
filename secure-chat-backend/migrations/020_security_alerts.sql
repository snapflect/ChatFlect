-- Migration: 020_security_alerts.sql
-- Epic 26: Security Alerts + Suspicious Login Detection
-- Purpose: Store security notifications for users.

CREATE TABLE IF NOT EXISTS security_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    alert_type ENUM('NEW_DEVICE_LOGIN', 'DEVICE_REVOKED', 'IP_CHANGE', 'ABUSE_LOCK', 'RATE_LIMIT_BLOCK') NOT NULL,
    severity ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    device_uuid VARCHAR(64) DEFAULT NULL,
    ip_address VARCHAR(64) DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    is_read TINYINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_user_unread (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
