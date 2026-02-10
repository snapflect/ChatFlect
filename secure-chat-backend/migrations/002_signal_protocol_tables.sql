-- Migration: 002_signal_protocol_tables
-- Description: Creates tables for LibSignal Key Distribution (IdentityKeys, PreKeys, SignedPreKeys)
-- Author: Antigravity
-- Date: 2026-02-07

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Identity Keys (Long-term)
-- Enforces: One Identity Key per User+Device pair.
CREATE TABLE IF NOT EXISTS `identity_keys` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(50) NOT NULL,
    `device_id` INT NOT NULL DEFAULT 1 COMMENT 'LibSignal Device ID (Default: 1)',
    `registration_id` INT NOT NULL COMMENT 'LibSignal Registration ID',
    `public_key` TEXT NOT NULL COMMENT 'Base64 Encoded Identity Key',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Constraint: Composite Unique Key ensures atomic user/device mapping
    UNIQUE KEY `uk_user_device` (`user_id`, `device_id`),
    INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Signed PreKeys (Medium-term)
-- Enforces: Unique Key ID per User+Device. Allows checking for 'active' key.
CREATE TABLE IF NOT EXISTS `signed_pre_keys` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(50) NOT NULL,
    `device_id` INT NOT NULL DEFAULT 1,
    `key_id` INT NOT NULL COMMENT 'Signal Key ID (0-16777215)',
    `public_key` TEXT NOT NULL COMMENT 'Base64 Encoded',
    `signature` TEXT NOT NULL COMMENT 'Base64 Encoded Signature',
    `details` TEXT DEFAULT NULL COMMENT 'JSON: created_at locally, etc',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `is_active` BOOLEAN DEFAULT TRUE COMMENT 'Only one active per device ideally',
    
    UNIQUE KEY `uk_key_id` (`user_id`, `device_id`, `key_id`),
    INDEX `idx_active_fetch` (`user_id`, `device_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. One-Time PreKeys (Ephemeral)
-- Critical: 'consumed_at' field for Atomic Consumption.
CREATE TABLE IF NOT EXISTS `pre_keys` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(50) NOT NULL,
    `device_id` INT NOT NULL DEFAULT 1,
    `key_id` INT NOT NULL COMMENT 'Signal Key ID (0-16777215)',
    `public_key` TEXT NOT NULL COMMENT 'Base64 Encoded',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `consumed_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'NULL = Available, TIMESTAMP = Used',
    
    UNIQUE KEY `uk_prekey_id` (`user_id`, `device_id`, `key_id`),
    -- Index for finding available keys efficiently during fetch
    INDEX `idx_claim_optim` (`user_id`, `device_id`, `consumed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Audit Log (Security)
-- Tracks all key operations for abuse detection regarding Story 2.2 policies
CREATE TABLE IF NOT EXISTS `prekey_audit_log` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `actor_user_id` VARCHAR(50) NOT NULL COMMENT 'Who performed the action',
    `target_user_id` VARCHAR(50) NOT NULL COMMENT 'Who was affected (e.g., fetched)',
    `target_device_id` INT DEFAULT NULL,
    `action_type` ENUM('UPLOAD_KEYS', 'FETCH_BUNDLE', 'ROTATE_SPK', 'IDENTITY_CHANGE', 'EXHAUSTION_WARNING') NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `user_agent` TEXT DEFAULT NULL,
    `metadata` TEXT DEFAULT NULL COMMENT 'JSON args or error info',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_audit_actor` (`actor_user_id`, `created_at`),
    INDEX `idx_audit_target` (`target_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Update Devices Table (If needed for migration)
-- Ensuring existing user_devices table is compatible or linking it.
-- Assuming `user_devices` exists (Story 1.1). We might want to link `device_id` here.
-- For MVP, we use the `device_uuid` (string) as the primary handle in `user_devices`, 
-- and `device_id` (int) as the Signal ID.
-- We should add `libsignal_device_id` to `user_devices` if not present.

-- Check if column exists, if not add it (Idempotent-ish)
SET @dbname = DATABASE();
SET @tablename = "user_devices";
SET @columnname = "libsignal_device_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE user_devices ADD COLUMN libsignal_device_id INT NOT NULL DEFAULT 1 AFTER device_uuid;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET FOREIGN_KEY_CHECKS = 1;

-- End Migration
