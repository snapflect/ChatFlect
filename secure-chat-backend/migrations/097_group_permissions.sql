-- 097_group_permissions.sql
-- Epic 82: Group Admin Controls

ALTER TABLE `groups`
ADD COLUMN `only_admins_message` BOOLEAN DEFAULT FALSE,
ADD COLUMN `only_admins_edit_info` BOOLEAN DEFAULT FALSE,
ADD COLUMN `only_admins_add_users` BOOLEAN DEFAULT FALSE,
ADD COLUMN `approval_required_to_join` BOOLEAN DEFAULT FALSE;

-- Audit Log for Group Settings
CREATE TABLE IF NOT EXISTS `group_audit_logs` (
    `log_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARBINARY(32) NOT NULL,
    `actor_user_id` INT NOT NULL,
    `action_type` VARCHAR(50) NOT NULL, -- 'UPDATE_SETTINGS', 'CHANGE_ROLE'
    `details` JSON,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
    -- FK to groups if possible, but group_id might be binary
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
