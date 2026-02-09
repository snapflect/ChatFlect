-- 072_archive_tier.sql
-- Epic 64: Archive Tier (Long-term immutable storage)

CREATE TABLE IF NOT EXISTS `archive_snapshots` (
    `snapshot_id` BINARY(16) NOT NULL PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `snapshot_date` DATE NOT NULL,
    `mongo_start_id` VARCHAR(64) DEFAULT NULL, -- Pointer to message range
    `mongo_end_id` VARCHAR(64) DEFAULT NULL,
    `audit_start_id` INT DEFAULT NULL,
    `audit_end_id` INT DEFAULT NULL,
    `file_path` VARCHAR(255) NOT NULL, -- Path to encrypted archive bundle
    `file_hash` VARCHAR(64) NOT NULL,
    `signature` TEXT NOT NULL,
    `status` ENUM('GENERATING', 'STORED', 'RESTORE_REQUESTED', 'PURGED') DEFAULT 'GENERATING',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_org_date` (`org_id`, `snapshot_date`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
