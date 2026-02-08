-- 024_groups.sql
-- Epic 41: Group Chat Schema + Membership Model

-- Table 1: groups
CREATE TABLE IF NOT EXISTS `groups` (
    `group_id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `created_by` VARCHAR(255) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_active` TINYINT(1) DEFAULT 1,
    INDEX `idx_created_by` (`created_by`),
    INDEX `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: group_members
CREATE TABLE IF NOT EXISTS `group_members` (
    `group_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'member') DEFAULT 'member',
    `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `removed_at` TIMESTAMP NULL DEFAULT NULL,
    `added_by` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`group_id`, `user_id`),
    INDEX `idx_user_groups` (`user_id`, `group_id`),
    INDEX `idx_group_members` (`group_id`, `removed_at`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 3: group_audit_log
CREATE TABLE IF NOT EXISTS `group_audit_log` (
    `audit_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(64) NOT NULL,
    `actor_user_id` VARCHAR(255) NOT NULL,
    `target_user_id` VARCHAR(255) NULL,
    `action` ENUM('GROUP_CREATED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'ROLE_CHANGED', 'GROUP_TITLE_UPDATED') NOT NULL,
    `metadata` JSON NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_group_audit` (`group_id`, `created_at`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
