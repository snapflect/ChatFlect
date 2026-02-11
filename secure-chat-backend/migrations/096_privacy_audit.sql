-- 096_privacy_audit.sql
-- Epic 81 HF: Audit Logs for Privacy Changes

CREATE TABLE IF NOT EXISTS `privacy_audit_logs` (
    `log_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `field_name` VARCHAR(50) NOT NULL,
    `old_value` VARCHAR(50),
    `new_value` VARCHAR(50) NOT NULL,
    `changed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `ip_address` VARCHAR(45), -- IPv6 OK
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
