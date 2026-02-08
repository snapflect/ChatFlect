-- Migration: 023_alerts.sql
-- Epic 31: SLA Targets + Alert Threshold Rules
-- Purpose: Store historical system alerts for incident tracking.

CREATE TABLE IF NOT EXISTS system_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    severity ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'WARNING',
    endpoint VARCHAR(255) DEFAULT NULL,
    message VARCHAR(500) NOT NULL,
    value DOUBLE DEFAULT NULL,
    threshold DOUBLE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    
    INDEX idx_type_created (alert_type, created_at),
    INDEX idx_severity_created (severity, created_at),
    INDEX idx_unresolved (resolved_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
