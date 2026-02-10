-- Migration: 022_metrics.sql
-- Epic 29: Metrics Collection + Latency Dashboard
-- Purpose: Store request performance metrics for P50/P95/P99 analysis.

-- API Request Metrics (raw events)
CREATE TABLE IF NOT EXISTS api_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    user_id VARCHAR(255) DEFAULT NULL,
    device_uuid VARCHAR(64) DEFAULT NULL,
    status_code INT NOT NULL,
    duration_ms DOUBLE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_endpoint_created (endpoint, created_at),
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_status_created (status_code, created_at),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System Counters (aggregated)
CREATE TABLE IF NOT EXISTS system_counters (
    metric_key VARCHAR(255) PRIMARY KEY,
    metric_value BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize default counters
INSERT IGNORE INTO system_counters (metric_key, metric_value) VALUES
    ('relay_send_total', 0),
    ('relay_send_errors', 0),
    ('relay_pull_total', 0),
    ('rate_limit_blocks_total', 0),
    ('abuse_blocks_total', 0);
