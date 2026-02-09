-- 087_vault_items.sql
-- Epic 69: Encrypted Vault Items

CREATE TABLE IF NOT EXISTS `vault_items` (
    `item_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `key_id` INT NOT NULL, -- Which vault key encrypted this item
    `item_type` ENUM('NOTE', 'FILE') NOT NULL,
    `enc_metadata` BLOB NOT NULL, -- Encrypted title/filename/mime-type
    `enc_payload` LONGBLOB NULL, -- Encrypted content (NULL if chunked file)
    `nonce` BINARY(12) NOT NULL, -- 96-bit nonce
    `auth_tag` BINARY(16) NOT NULL, -- GCM Auth Tag
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
    -- Key FK defined later or logic-enforced
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
