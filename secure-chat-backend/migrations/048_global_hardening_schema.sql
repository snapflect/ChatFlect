-- 048_global_hardening_schema.sql
-- Global Security Hardening (Epic 51-54)
-- Combined migration for Audit Hashing, Abuse Correlation, and Compliance.

-- HF-51.5: Audit Hash Chaining
-- Add row_hash to create a tamper-evident blockchain-style log.
ALTER TABLE `security_audit_log` 
ADD COLUMN `row_hash` CHAR(64) DEFAULT NULL AFTER `metadata`,
ADD INDEX `idx_row_hash` (`row_hash`);

-- HF-52.9: Abuse Correlation Graph
-- Tracks relationships between Users, IPs, and Devices to detect ban evasion.
CREATE TABLE IF NOT EXISTS `abuse_correlation` (
    `link_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT DEFAULT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `device_id` VARCHAR(64) DEFAULT NULL,
    `seen_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_user` (`user_id`),
    INDEX `idx_ip` (`ip_address`),
    INDEX `idx_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
