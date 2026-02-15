-- 098_contact_verifications.sql
-- Epic 72: Trust Verification Center

CREATE TABLE IF NOT EXISTS `contact_verifications` (
    `verification_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `contact_user_id` VARCHAR(255) NOT NULL,
    `verified_key_hash` VARCHAR(64) NOT NULL, -- SHA256 of the Identity Key
    `status` ENUM('VERIFIED', 'UNVERIFIED', 'BROKEN') DEFAULT 'VERIFIED',
    `verified_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `idx_pair` (`user_id`, `contact_user_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`contact_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
