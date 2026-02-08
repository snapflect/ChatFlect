-- Migration: 017_rate_limits.sql
-- Epic 23: Rate Limiting Framework
-- Purpose: Store rate limit events for rolling window enforcement.

CREATE TABLE IF NOT EXISTS rate_limit_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_uuid VARCHAR(64) NOT NULL,
    user_id VARCHAR(255) DEFAULT NULL,
    device_uuid VARCHAR(64) DEFAULT NULL,
    ip_address VARCHAR(64) NOT NULL,
    endpoint VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for efficient rolling window queries
    INDEX idx_device_endpoint (device_uuid, endpoint, created_at),
    INDEX idx_user_endpoint (user_id, endpoint, created_at),
    INDEX idx_ip_endpoint (ip_address, endpoint, created_at),
    
    -- Unique index for idempotency / deduplication
    UNIQUE INDEX idx_request_uuid (request_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
