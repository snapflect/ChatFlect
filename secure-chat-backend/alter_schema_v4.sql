-- Migration Script v4
-- Hybrid Identity & Contact Discovery

-- 1. Update Users Table
ALTER TABLE `users` 
MODIFY `email` varchar(100) NOT NULL,
ADD UNIQUE KEY `email` (`email`),
ADD COLUMN `google_profile_data` JSON DEFAULT NULL AFTER `google_sub`,
ADD COLUMN `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() AFTER `created_at`;

-- 2. Update Contacts Table
ALTER TABLE `contacts`
ADD COLUMN `source_type` ENUM('phone', 'email', 'invite') DEFAULT 'phone' AFTER `contact_user_id`;
