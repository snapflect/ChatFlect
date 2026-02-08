-- 045_abuse_scores.sql
-- Epic 52 Hardening: Abuse Score Engine
-- Tracks cumulative abuse points per actor (IP/User) with decay.

CREATE TABLE IF NOT EXISTS `abuse_scores` (
    `target_key` VARCHAR(128) PRIMARY KEY, -- Hash(Type + Value) e.g. "IP:1.2.3.4"
    `score` INT NOT NULL DEFAULT 0,
    `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_score` (`score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
