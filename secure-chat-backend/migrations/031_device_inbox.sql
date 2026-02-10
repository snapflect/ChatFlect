-- 031_device_inbox.sql
-- Epic 48: Device Specific Inbox (Fanout Destination)

CREATE TABLE IF NOT EXISTS `device_inbox` (
    `inbox_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `recipient_device_id` VARCHAR(64) NOT NULL,
    `message_uuid` VARCHAR(64) NOT NULL, -- Ties back to main message metadata
    `encrypted_payload` TEXT NOT NULL, -- Ciphertext specifically for this device
    `nonce` VARCHAR(64) NOT NULL, 
    `status` ENUM('PENDING', 'DELIVERED', 'ACKED') DEFAULT 'PENDING',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_pull` (`recipient_device_id`, `status`, `inbox_id`),
    FOREIGN KEY (`recipient_device_id`) REFERENCES `devices`(`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
