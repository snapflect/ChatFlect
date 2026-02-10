-- Migration: 019_device_audit.sql
-- Epic 25: Device Manager UI + Audit History
-- Purpose: Store device audit events for security transparency.

CREATE TABLE IF NOT EXISTS device_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    device_uuid VARCHAR(64) NOT NULL,
    event_type ENUM('LOGIN', 'REGISTER', 'REVOKE', 'TOKEN_REFRESH', 'LOGOUT') NOT NULL,
    ip_address VARCHAR(64) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_time (user_id, created_at),
    INDEX idx_device_time (device_uuid, created_at),
    INDEX idx_event_type (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
