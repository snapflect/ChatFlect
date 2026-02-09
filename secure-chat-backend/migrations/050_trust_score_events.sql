-- 050_trust_score_events.sql
-- Epic 55: Trust Score Events
-- Logs events that impact trust scores for auditability and recalculation.

CREATE TABLE IF NOT EXISTS `trust_score_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `actor_type` ENUM('USER', 'DEVICE', 'IP') NOT NULL,
    `actor_value` VARCHAR(128) NOT NULL,
    `event_type` VARCHAR(64) NOT NULL, -- e.g. 'RATE_LIMIT_HIT', 'BAN', 'CLEAN_DAY'
    `score_delta` INT NOT NULL,
    `reason` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_actor_event` (`actor_type`, `actor_value`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
