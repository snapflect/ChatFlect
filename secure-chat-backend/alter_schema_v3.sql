-- Migration Script v3
-- Fixes for Google Sign-In 500 error

ALTER TABLE `users` 
MODIFY `phone_number` varchar(50) DEFAULT NULL,
ADD COLUMN `google_sub` varchar(255) DEFAULT NULL AFTER `public_key`,
ADD UNIQUE KEY `google_sub` (`google_sub`);
