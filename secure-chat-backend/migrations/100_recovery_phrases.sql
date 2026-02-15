-- 100_recovery_phrases.sql
-- Epic 73: Recovery Phrase Storage (Hashed)

CREATE TABLE IF NOT EXISTS `recovery_phrases` (
    `user_id` VARCHAR(255) NOT NULL PRIMARY KEY,
    `phrase_hash` VARBINARY(64) NOT NULL, -- SSHA256 or Argon2 hash of the mnemonic
    `salt` VARBINARY(32) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
