-- 090_message_ttl_rules.sql
-- Epic 70: Disappearing Messages Policies

CREATE TABLE IF NOT EXISTS `conversation_ttl_rules` (
    `conversation_id` BINARY(16) NOT NULL PRIMARY KEY,
    `default_ttl_seconds` INT DEFAULT NULL, -- NULL = infinite/permanent
    `allow_shorter_overrides` BOOLEAN DEFAULT TRUE,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` INT NULL,
    
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
