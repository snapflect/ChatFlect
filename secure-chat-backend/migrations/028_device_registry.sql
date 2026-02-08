-- 028_device_registry.sql
-- Epic 47: Multi-Device Registry

CREATE TABLE IF NOT EXISTS `devices` (
    `device_id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `platform` ENUM('android', 'ios', 'web') NOT NULL,
    `device_name` VARCHAR(100) DEFAULT NULL,
    `public_identity_key` TEXT NOT NULL,
    `public_pre_key` TEXT NOT NULL,
    `trust_state` ENUM('PENDING', 'TRUSTED', 'REVOKED') DEFAULT 'PENDING',
    `fingerprint` CHAR(64) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `last_seen_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `revoked_at` TIMESTAMP NULL DEFAULT NULL,
    INDEX `idx_user_devices` (`user_id`, `trust_state`),
    INDEX `idx_fingerprint` (`fingerprint`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
