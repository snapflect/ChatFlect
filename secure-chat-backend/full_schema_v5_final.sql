-- SnapFlect Full Schema v5 Final (Identity + Performance Caching)
-- Usage: Run this to completely reset the database.

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- 1. Clean Up
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `rate_limits`;
DROP TABLE IF EXISTS `user_sessions`;
DROP TABLE IF EXISTS `cache_store`;
DROP TABLE IF EXISTS `user_devices`;
DROP TABLE IF EXISTS `status_updates`;
DROP TABLE IF EXISTS `calls`;
DROP TABLE IF EXISTS `group_members`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `contacts`;
DROP TABLE IF EXISTS `otps`;
DROP TABLE IF EXISTS `users`;

-- 2. Users Table
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `google_sub` varchar(255) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `short_note` varchar(255) DEFAULT NULL,
  `photo_url` varchar(500) DEFAULT NULL,
  `public_key` text DEFAULT NULL,
  `google_profile_data` JSON DEFAULT NULL,
  `fcm_token` text DEFAULT NULL,
  `is_blocked` tinyint(1) DEFAULT 0,
  `is_profile_complete` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone_number` (`phone_number`),
  UNIQUE KEY `google_sub` (`google_sub`),
  INDEX `idx_email_phone` (`email`, `phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Cache Store (API Result & Expensive Query Caching)
CREATE TABLE `cache_store` (
    `cache_key` VARCHAR(255) PRIMARY KEY,
    `cache_value` MEDIUMTEXT NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. User Sessions (Session Management & Multi-Device)
CREATE TABLE `user_sessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(50) NOT NULL,
    `device_uuid` VARCHAR(64) NOT NULL,
    `id_token_jti` VARCHAR(64) NOT NULL,
    `refresh_token` VARCHAR(255) NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `last_active` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_session` (`user_id`, `device_uuid`),
    INDEX `idx_jti` (`id_token_jti`),
    INDEX `idx_refresh` (`refresh_token`),
    CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. OTPs Table (Email/Phone verification)
CREATE TABLE `otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `otp_code` varchar(10) NOT NULL,
  `type` enum('registration', 'phone_update') DEFAULT 'registration',
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_otp_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Contacts Table
CREATE TABLE `contacts` (
  `user_id` int(11) NOT NULL,
  `contact_user_id` int(11) NOT NULL,
  `source_type` ENUM('phone', 'email', 'invite') DEFAULT 'phone',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`, `contact_user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`contact_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Groups
CREATE TABLE `groups` (
  `id` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_by` varchar(255) NOT NULL,
  `settings` text DEFAULT NULL,
  `invite_code` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `invite_code` (`invite_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Group Members
CREATE TABLE `group_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` varchar(100) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `role` enum('admin','member') DEFAULT 'member',
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_membership` (`group_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Calls
CREATE TABLE `calls` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `call_uuid` varchar(100) DEFAULT NULL,
  `caller_id` varchar(255) NOT NULL,
  `receiver_id` varchar(255) NOT NULL,
  `type` enum('audio','video') DEFAULT 'audio',
  `status` enum('initiated','ongoing','ended','missed') DEFAULT 'initiated',
  `start_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `end_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Status Updates
CREATE TABLE `status_updates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL,
  `media_url` varchar(500) DEFAULT NULL,
  `type` enum('image','video','text') DEFAULT 'image',
  `caption` text DEFAULT NULL,
  `text_content` text DEFAULT NULL,
  `background_color` varchar(20) DEFAULT '#000000',
  `font` varchar(50) DEFAULT 'sans-serif',
  `privacy` enum('everyone','contacts','whitelist','blacklist') DEFAULT 'everyone',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. User Devices
CREATE TABLE `user_devices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL,
  `device_uuid` varchar(64) NOT NULL,
  `public_key` text NOT NULL,
  `fcm_token` text DEFAULT NULL,
  `device_name` varchar(100) DEFAULT 'Unknown Device',
  `last_active` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_device` (`user_id`, `device_uuid`),
  CONSTRAINT `fk_device_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Rate Limits
CREATE TABLE `rate_limits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `request_count` int(11) DEFAULT 1,
  `window_start` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_identifier_endpoint` (`identifier`, `endpoint`),
  INDEX `idx_window_start` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Audit Logs
CREATE TABLE `audit_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `details` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_user_action` (`user_id`, `action`),
  INDEX `idx_action_time` (`action`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
