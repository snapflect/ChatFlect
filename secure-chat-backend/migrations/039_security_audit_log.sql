-- 039_security_audit_log.sql
-- Epic 51: Centralized Security Audit Log
-- Stores all security-critical events for compliance and abuse detection.

CREATE TABLE IF NOT EXISTS `security_audit_log` (
    `audit_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_type` VARCHAR(64) NOT NULL, -- e.g. 'DEVICE_REVOKED', 'DECRYPT_FAIL'
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL', 'BLOCKER') NOT NULL DEFAULT 'INFO',
    `user_id` VARCHAR(255) DEFAULT NULL, -- Nullable for unauth events
    `device_id` VARCHAR(64) DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `metadata` JSON DEFAULT NULL, -- Context: msg_id, payload_hash, etc.
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_event_type` (`event_type`),
    INDEX `idx_user_severity` (`user_id`, `severity`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HF-51.2: Immutable Audit Store (Updated HF-51.7)
-- Trigger to block Updates/Deletes UNLESS privileged session var is set
DELIMITER //
CREATE TRIGGER `prevent_audit_update` BEFORE UPDATE ON `security_audit_log`
FOR EACH ROW
BEGIN
    IF @allow_audit_cleanup IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security Audit Logs are Immutable';
    END IF;
END;
//
CREATE TRIGGER `prevent_audit_delete` BEFORE DELETE ON `security_audit_log`
FOR EACH ROW
BEGIN
    IF @allow_audit_cleanup IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security Audit Logs are Immutable';
    END IF;
END;
//
DELIMITER ;


