-- 079_scim_events.sql
-- Epic 66: SCIM Audit Events

CREATE TABLE IF NOT EXISTS `scim_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `token_id` INT NOT NULL,
    `action_type` VARCHAR(50) NOT NULL, -- USER_CREATE, USER_UPDATE, USER_DELETE
    `target_user_email` VARCHAR(255) NULL,
    `payload_summary` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_org_time` (`org_id`, `created_at`),
    FOREIGN KEY (`token_id`) REFERENCES `scim_tokens`(`token_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
