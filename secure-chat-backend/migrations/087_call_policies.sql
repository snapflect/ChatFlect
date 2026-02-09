-- 087_call_policies.sql
-- Epic 77: Org Call Policies

CREATE TABLE IF NOT EXISTS `org_call_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` INT NOT NULL,
    `allow_calls` BOOLEAN DEFAULT TRUE,
    `allow_video` BOOLEAN DEFAULT TRUE,
    `require_verified_contacts` BOOLEAN DEFAULT FALSE,
    `max_duration_seconds` INT DEFAULT 3600, -- 1 hour default
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_org_policy` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
