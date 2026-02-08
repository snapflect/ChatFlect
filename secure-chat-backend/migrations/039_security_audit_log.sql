-- 039_security_audit_log.sql
-- Epic 51: Centralized Security Audit Log
-- Stores all security-critical events for compliance and abuse detection.

CREATE TABLE IF NOT EXISTS `security_audit_log` (
    `audit_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_type` VARCHAR(64) NOT NULL, -- e.g. 'DEVICE_REVOKED', 'DECRYPT_FAIL'
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL', 'BLOCKER') NOT NULL DEFAULT 'INFO',
    `user_id` INT DEFAULT NULL, -- Nullable for unauth events
    `device_id` VARCHAR(64) DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `metadata` JSON DEFAULT NULL, -- Context: msg_id, payload_hash, etc.
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_event_type` (`event_type`),
    INDEX `idx_user_severity` (`user_id`, `severity`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
