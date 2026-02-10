-- Migration: 018_abuse_scores.sql
-- Epic 24: Spam Detection Heuristics
-- Purpose: Store abuse events and aggregated risk scores.

-- Table: abuse_events (Event Log)
CREATE TABLE IF NOT EXISTS abuse_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    device_uuid VARCHAR(64) DEFAULT NULL,
    ip_address VARCHAR(64) NOT NULL,
    event_type ENUM('BURST_SEND', 'NEW_BLAST', 'REPAIR_ABUSE', 'PULL_ABUSE', 'IP_HOP', 'DEVICE_FLOOD', 'ABUSE_LOCK') NOT NULL,
    weight INT NOT NULL DEFAULT 0,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_device_created (device_uuid, created_at),
    INDEX idx_ip_created (ip_address, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: abuse_scores (Aggregated Risk)
CREATE TABLE IF NOT EXISTS abuse_scores (
    user_id VARCHAR(255) PRIMARY KEY,
    score INT NOT NULL DEFAULT 0,
    risk_level ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    cooldown_until TIMESTAMP NULL DEFAULT NULL,
    
    INDEX idx_risk_level (risk_level),
    INDEX idx_cooldown (cooldown_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
