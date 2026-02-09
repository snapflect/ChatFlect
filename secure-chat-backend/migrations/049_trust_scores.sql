-- 049_trust_scores.sql
-- Epic 55: Trust Score Engine
-- Stores the current trust score and level for actors.

CREATE TABLE IF NOT EXISTS `trust_scores` (
    `trust_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `actor_type` ENUM('USER', 'DEVICE', 'IP') NOT NULL,
    `actor_value` VARCHAR(128) NOT NULL,
    `trust_score` INT NOT NULL DEFAULT 400, -- Default for User
    `trust_level` ENUM('LOW', 'MEDIUM', 'HIGH', 'VERIFIED') GENERATED ALWAYS AS (
        CASE 
            WHEN trust_score < 300 THEN 'LOW'
            WHEN trust_score < 600 THEN 'MEDIUM'
            WHEN trust_score < 800 THEN 'HIGH'
            ELSE 'VERIFIED'
        END
    ) STORED,
    `last_updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `idx_actor` (`actor_type`, `actor_value`),
    INDEX `idx_level` (`trust_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
