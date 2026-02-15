-- 067_compliance_exports.sql
-- Epic 63: Compliance Exports (Job Lifecycle)

CREATE TABLE IF NOT EXISTS `compliance_exports` (
    `export_id` BINARY(16) NOT NULL PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `requested_by_user_id` VARCHAR(255) NOT NULL,
    `start_date` DATETIME NOT NULL,
    `end_date` DATETIME NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    `file_path` VARCHAR(255) DEFAULT NULL, -- Path to .zip
    `file_hash` VARCHAR(64) DEFAULT NULL, -- SHA256 of .zip
    `signature` TEXT DEFAULT NULL, -- RSA Signature of .zip (or manifest)
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `completed_at` TIMESTAMP NULL,
    `error_message` TEXT DEFAULT NULL,
    
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
