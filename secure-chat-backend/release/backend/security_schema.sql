-- Security Enhancements Database Schema
-- Run this SQL on your MySQL database to create required tables

-- Rate Limiting Table
CREATE TABLE IF NOT EXISTS rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL COMMENT 'IP address or user ID',
    endpoint VARCHAR(255) NOT NULL COMMENT 'API endpoint path',
    request_count INT DEFAULT 1 COMMENT 'Number of requests in window',
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Start of rate limit window',
    INDEX idx_identifier_endpoint (identifier, endpoint),
    INDEX idx_window_start (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NULL COMMENT 'User performing the action',
    action VARCHAR(100) NOT NULL COMMENT 'Action type (login, logout, etc.)',
    details TEXT NULL COMMENT 'JSON details about the event',
    ip_address VARCHAR(45) NULL COMMENT 'Client IP address',
    user_agent TEXT NULL COMMENT 'Client user agent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the event occurred',
    INDEX idx_user_action (user_id, action),
    INDEX idx_action_time (action, created_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clean up old rate limit entries (run periodically via cron)
-- DELETE FROM rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Clean up old audit logs (keep 90 days)
-- DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
