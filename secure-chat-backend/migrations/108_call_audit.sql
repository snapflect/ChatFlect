-- 108_call_audit.sql
-- Epic 76 HF: Call Audit & Abuse Prevention

CREATE TABLE IF NOT EXISTS `call_audit_logs` (
    `log_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `call_id` VARBINARY(32) NOT NULL,
    `user_id` INT NOT NULL,
    `device_id` VARCHAR(64),
    `action` ENUM('JOIN_ATTEMPT', 'JOIN_FAILED', 'JOIN_SUCCESS', 'RATCHET', 'END') NOT NULL,
    `reason` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_call_audit_user` (`user_id`, `created_at`),
    INDEX `idx_call_audit_call` (`call_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `call_lockdowns` (
    `call_id` VARBINARY(32) PRIMARY KEY,
    `locked_until` TIMESTAMP NOT NULL,
    `failure_count` INT DEFAULT 0,
    `last_failure_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
