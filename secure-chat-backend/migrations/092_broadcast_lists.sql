-- 092_broadcast_lists.sql
-- Epic 79: Broadcast Lists Metadata

CREATE TABLE IF NOT EXISTS `broadcast_lists` (
    `list_id` VARBINARY(32) NOT NULL PRIMARY KEY, -- UUID
    `owner_user_id` INT NOT NULL,
    `list_name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    
    INDEX `idx_broadcast_owner` (`owner_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
