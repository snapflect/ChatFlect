-- 093_broadcast_list_members.sql
-- Epic 79: Broadcast List Members

CREATE TABLE IF NOT EXISTS `broadcast_list_members` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `list_id` VARBINARY(32) NOT NULL,
    `member_user_id` INT NOT NULL,
    `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_list_member` (`list_id`, `member_user_id`),
    INDEX `idx_list_members` (`list_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
