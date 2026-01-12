-- Database Restore Script (v2)
-- Usage: Run this in phpMyAdmin or MySQL CLI to reset/restore the database structure.
-- WARNING: This will DROP existing tables and data!

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- 1. Clean Up
DROP TABLE IF EXISTS `status_updates`;
DROP TABLE IF EXISTS `calls`;
DROP TABLE IF EXISTS `group_members`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `contacts`;
DROP TABLE IF EXISTS `otps`;
DROP TABLE IF EXISTS `profiles`; -- Legacy
DROP TABLE IF EXISTS `users`;

-- 2. Users Table (Consolidated)
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL, -- UUID
  `phone_number` varchar(50) NOT NULL,
  `email` varchar(100) DEFAULT NULL, -- Added for Auth v2
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `short_note` varchar(255) DEFAULT NULL,
  `photo_url` varchar(500) DEFAULT NULL,
  `public_key` text DEFAULT NULL, -- Critical for Encryption
  `fcm_token` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone_number` (`phone_number`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. OTPs Table (Required for Auth)
CREATE TABLE `otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `phone_number` varchar(50) NOT NULL,
  `otp_code` varchar(10) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_phone` (`phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Contacts Table
CREATE TABLE `contacts` (
  `user_id` int(11) NOT NULL,
  `contact_user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`, `contact_user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`contact_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Groups Table
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

-- 6. Group Members
CREATE TABLE `group_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` varchar(100) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `role` enum('admin','member') DEFAULT 'member',
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_membership` (`group_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Calls
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

-- 8. Status Updates
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

COMMIT;
