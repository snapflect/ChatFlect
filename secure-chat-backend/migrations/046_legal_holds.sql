-- 046_legal_holds.sql
-- Epic 54: Legal Hold Tracking
-- Overrides retention policies for specific targets.

CREATE TABLE IF NOT EXISTS `legal_holds` (
    `hold_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `target_type` ENUM('USER', 'DEVICE', 'CONVERSATION') NOT NULL,
    `target_value` VARCHAR(128) NOT NULL,
    `case_reference` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL, -- HF-54.3: Auto-expiry
    `review_required` TINYINT(1) DEFAULT 0, -- HF-54.3: Flag for review
    `created_by` VARCHAR(64) NOT NULL,
    `active` TINYINT(1) DEFAULT 1,

    
    INDEX `idx_target` (`target_type`, `target_value`),
    INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
