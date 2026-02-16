-- 088_vault_keys.sql
-- Epic 69: Vault Keys (Per-User Rotation)

CREATE TABLE IF NOT EXISTS `vault_keys` (
    `key_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `version` INT NOT NULL, -- 1, 2, 3...
    `salt` BINARY(32) NOT NULL, -- Salt for KDF
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_user_version` (`user_id`, `version`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `vault_items`
ADD CONSTRAINT `fk_vault_key` FOREIGN KEY (`key_id`) REFERENCES `vault_keys`(`key_id`) ON DELETE CASCADE;
