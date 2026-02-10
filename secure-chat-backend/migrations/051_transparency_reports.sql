-- 051_transparency_reports.sql
-- Epic 56: Transparency Reporting System
-- Stores immutable, signed transparency reports.

CREATE TABLE IF NOT EXISTS `transparency_reports` (
    `report_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `generated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `report_json` JSON NOT NULL, -- Full statistical payload
    `integrity_hash` CHAR(64) NOT NULL, -- SHA256 of report_json
    `signature` TEXT DEFAULT NULL, -- RSA signature of integrity_hash
    
    UNIQUE KEY `idx_period` (`period_start`, `period_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
