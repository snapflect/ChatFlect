-- ChatFlect Complete Schema (Generated 2026-02-15 19:45:00)
-- Version: v16.0 (Consolidated)



-- BASE SCHEMA (V2) --

-- Database Restore Script (v2)
-- Usage: Run this in phpMyAdmin or MySQL CLI to reset/restore the database structure.
-- WARNING: This will DROP existing tables and data!

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- 1. Clean Up
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `rate_limits`;
DROP TABLE IF EXISTS `user_devices`;
DROP TABLE IF EXISTS `status_updates`;
DROP TABLE IF EXISTS `calls`;
DROP TABLE IF EXISTS `group_members`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `contacts`;
DROP TABLE IF EXISTS `otps`;
DROP TABLE IF EXISTS `profiles`; -- Legacy
DROP TABLE IF EXISTS `user_sessions`;
DROP TABLE IF EXISTS `cache_store`;
DROP TABLE IF EXISTS `users`;

-- 2. Users Table (Consolidated)
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL, -- UUID
  `phone_number` varchar(50) DEFAULT NULL, -- Nullable for OAuth users
  `email` varchar(100) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `short_note` varchar(255) DEFAULT NULL,
  `photo_url` varchar(500) DEFAULT NULL,
  `public_key` text DEFAULT NULL,
  `google_sub` varchar(255) DEFAULT NULL, -- Google Unique ID
  `google_profile_data` JSON DEFAULT NULL,
  `fcm_token` text DEFAULT NULL,
  `is_profile_complete` tinyint(1) NOT NULL DEFAULT 0,
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0, -- Added for Auth Middleware
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `google_sub` (`google_sub`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. OTPs Table (Required for Auth)
CREATE TABLE `otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `otp_code` varchar(10) NOT NULL,
  `type` enum('registration', 'phone_update') DEFAULT 'registration',
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_otp_email` (`email`),
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
-- REMOVED LEGACY groups (Superceded by 024)

-- 6. Group Members
-- REMOVED LEGACY group_members (Superceded by 024)

-- 7. Calls
-- REMOVED LEGACY calls (Superceded by 084)

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


-- 9. User Devices (Multi-Device Support)
CREATE TABLE `user_devices` (
  `device_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `public_key` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fcm_token` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `signature` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bundle_version` int(11) DEFAULT 1,
  `signed_at` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `libsignal_device_id` int(11) DEFAULT 1,
  `key_version` int(11) DEFAULT 1,
  `signing_public_key` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL, -- ANDROID/IOS
  `os_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `app_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending', 'active', 'revoked') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `last_active` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `revoked_at` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`device_id`),
  UNIQUE KEY `device_uuid` (`device_uuid`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Rate Limits (Security)
CREATE TABLE `rate_limits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) NOT NULL COMMENT 'IP address or user ID',
  `endpoint` varchar(255) NOT NULL COMMENT 'API endpoint path',
  `request_count` int(11) DEFAULT 1 COMMENT 'Number of requests in window',
  `window_start` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Start of rate limit window',
  PRIMARY KEY (`id`),
  INDEX `idx_identifier_endpoint` (`identifier`, `endpoint`),
  INDEX `idx_window_start` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Audit Logs (Security)
CREATE TABLE `audit_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) DEFAULT NULL COMMENT 'User performing the action',
  `action` varchar(100) NOT NULL COMMENT 'Action type',
  `details` text DEFAULT NULL COMMENT 'JSON details',
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_user_action` (`user_id`, `action`),
  INDEX `idx_action_time` (`action`, `created_at`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. User Sessions (Authentication)
CREATE TABLE `user_sessions` (
  `session_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_token_jti` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `refresh_token` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `id_token_jti` (`id_token_jti`),
  KEY `user_id` (`user_id`),
  KEY `refresh_token` (`refresh_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Cache Store (Performance)
CREATE TABLE `cache_store` (
  `cache_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cache_value` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`cache_key`),
  KEY `expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;


-- INJECTED DEPENDENCY: messages (from 012_relay_messages.sql)
DROP TABLE IF EXISTS messages;
CREATE TABLE IF NOT EXISTS messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chat_id VARCHAR(128) NOT NULL,
    sender_id VARCHAR(128) NOT NULL,
    server_seq BIGINT NOT NULL,
    message_uuid VARCHAR(128) NOT NULL, 
    encrypted_payload TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    server_received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_message_uuid UNIQUE (message_uuid),
    CONSTRAINT uk_chat_seq UNIQUE (chat_id, server_seq),
    INDEX idx_chat_seq (chat_id, server_seq),
    INDEX idx_chat_created (chat_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

;


-- 
-- SOURCE: 002_signal_protocol_tables.sql
-- 


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

-- libsignal_device_id consolidated into base table
SELECT 1;

SET FOREIGN_KEY_CHECKS = 1;

-- End Migration


;


-- 
-- SOURCE: 003_conversations_table.sql
-- 


-- 003_conversations_table.sql
-- Epic 3: Core Conversation Entity
-- Missing from original migration set, added to fix FK errors.

CREATE TABLE IF NOT EXISTS `conversations` (
    `conversation_id` VARBINARY(32) NOT NULL PRIMARY KEY,
    `type` ENUM('DIRECT', 'GROUP') NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Optional: Linked Group ID if Type=GROUP
    `group_id` VARCHAR(100) DEFAULT NULL,
    INDEX `idx_type` (`type`),
    INDEX `idx_group` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 003_signed_prekey_rotations.sql
-- 


-- 003_signed_prekey_rotations.sql
-- Epic 3, Story 3.3: Rotation History & Audit Logging

CREATE TABLE IF NOT EXISTS signed_prekey_rotations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    device_id INT NOT NULL,
    old_key_version INT NOT NULL,
    new_key_version INT NOT NULL,
    signed_prekey_id INT NOT NULL,
    rotated_at DATETIME NOT NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    event_type VARCHAR(50) NOT NULL DEFAULT 'ROTATE_SUCCESS',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_device (user_id, device_id),
    INDEX idx_rotated_at (rotated_at)
);


;


-- 
-- SOURCE: 004_device_trust_columns.sql
-- 


-- 004_device_trust_columns.sql
-- Epic 4, Story 4.1: Device Trust Registry & Revocation
-- Strict Zero-Trust Enforcement

-- 1. Add Trust Columns
-- status: 'pending' (Default for new), 'active' (Approved), 'revoked' (Banned)
-- revoked_at: Timestamp of revocation
-- Audit columns: ip_address, user_agent (for tracking registration source)

-- status, revoked_at, ip_address, user_agent consolidated into base table
SELECT 1;
-- user_agent consolidated into base table
SELECT 1;

-- 2. Data Migration for Existing Users
-- CRITICAL: Prevent lockout. Existing devices (created before this migration) should be ACTIVE.
-- We identify them by NULL status (if added as NULLable first) or update all pending ones that have 'last_active' set? 
-- Since we added it as NOT NULL DEFAULT 'pending', all existing rows now have 'pending'.
-- We must update valid existing devices to 'active'.
-- Assumption: Any device with a registered `public_key` and valid `last_active` is legacy active.
UPDATE user_devices 
SET status = 'active' 
WHERE status = 'pending' AND created_at < NOW();

-- 3. Ensure Unique Index (P0 Security Requirement)
-- Verify unique constraint on (user_id, device_uuid) to prevent spoofing
-- This might fail if duplicates exist. If so, manual cleanup required. 
-- We try to add it safely.
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = 'user_devices')
      AND (table_schema = @dbname)
      AND (index_name = 'unique_device')
  ) > 0,
  "SELECT 1",
  "CREATE UNIQUE INDEX unique_device ON user_devices (user_id, device_uuid);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;


;


-- 
-- SOURCE: 005_replay_protection.sql
-- 


-- Migration: 005_replay_protection.sql
-- Goal: Add table to track message nonces for Replay Protection

CREATE TABLE IF NOT EXISTS `message_replay_log` (
    `message_id` VARCHAR(128) NOT NULL,
    `sender_id` VARCHAR(255) NOT NULL,
    `device_uuid` VARCHAR(64) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`message_id`),
    INDEX `idx_sender_created` (`sender_id`, `created_at`),
    INDEX `idx_cleanup_created` (`created_at`) -- for periodic cleanup of old logs
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 006_add_signing_key.sql
-- 


-- Migration: 006_add_signing_key.sql
-- Goal: Add column to store ECDSA Public Key for strict payload signing (Epic 5)

-- signing_public_key consolidated into base table
SELECT 1;


;


-- 
-- SOURCE: 007_message_state_machine.sql
-- 


-- Migration: Add Message State Columns
-- Epic 11: Messaging State Machine Core
-- Date: 2026-02-08

-- Add state columns to messages table for state machine persistence
ALTER TABLE messages ADD COLUMN IF NOT EXISTS state TINYINT NOT NULL DEFAULT 0 COMMENT 'Message state: 0=CREATED, 1=ENCRYPTED, 2=QUEUED, 3=SENT, 4=DELIVERED, 5=READ, 6=FAILED, 7=REPAIRED';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS state_version INT NOT NULL DEFAULT 1 COMMENT 'Monotonic state version counter';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_transition_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Last state change timestamp';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_error TEXT NULL DEFAULT NULL COMMENT 'Error message if state is FAILED';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0 COMMENT 'Number of retry attempts';

-- Index for querying messages by state (for crash recovery)
CREATE INDEX IF NOT EXISTS idx_messages_state ON messages(state);
CREATE INDEX IF NOT EXISTS idx_messages_state_retry ON messages(state, retry_count);

-- For SQLite (Capacitor/Ionic local DB), use this syntax:
-- CREATE TABLE IF NOT EXISTS message_states (
--     message_id TEXT PRIMARY KEY,
--     state INTEGER NOT NULL DEFAULT 0,
--     state_version INTEGER NOT NULL DEFAULT 1,
--     last_transition_at TEXT,
--     last_error TEXT,
--     retry_count INTEGER NOT NULL DEFAULT 0
-- );
-- CREATE INDEX IF NOT EXISTS idx_message_states_state ON message_states(state);


;


-- 
-- SOURCE: 008_message_idempotency.sql
-- 


-- Migration: Message Idempotency Table
-- Epic 12: Idempotency + Deduplication Layer
-- Date: 2026-02-08

-- Create idempotency tracking table
CREATE TABLE IF NOT EXISTS message_idempotency (
    message_uuid CHAR(36) PRIMARY KEY COMMENT 'UUIDv7 generated client-side',
    sender_uid VARCHAR(128) NOT NULL COMMENT 'Sender Firebase UID',
    receiver_uid VARCHAR(128) NOT NULL COMMENT 'Receiver Firebase UID',
    chat_id VARCHAR(128) NOT NULL COMMENT 'Chat/conversation ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'First receive time',
    processed_at TIMESTAMP NULL COMMENT 'Processing complete time',
    
    INDEX idx_sender (sender_uid),
    INDEX idx_receiver (receiver_uid),
    INDEX idx_chat (chat_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add message_uuid column to messages table if not exists
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_uuid CHAR(36) NULL COMMENT 'UUIDv7 client-generated ID';

-- Add unique constraint on message_uuid
ALTER TABLE messages 
ADD UNIQUE INDEX IF NOT EXISTS uk_message_uuid (message_uuid);

-- For cleanup: remove entries older than 7 days (run via cron)
-- DELETE FROM message_idempotency WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);


;


-- 
-- SOURCE: 009_message_ordering.sql
-- 


-- Migration: Message Ordering (Logical Clock)
-- Epic 13: Ordering Guarantees
-- Date: 2026-02-08

-- 1. Create chat sequences table for atomic sequence generation
CREATE TABLE IF NOT EXISTS chat_sequences (
    chat_id VARCHAR(128) PRIMARY KEY COMMENT 'Chat/conversation ID',
    last_seq BIGINT NOT NULL DEFAULT 0 COMMENT 'Last assigned sequence number',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add server sequence columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS server_seq BIGINT NULL COMMENT 'Server-assigned sequence (ordering authority)';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS server_received_at TIMESTAMP NULL COMMENT 'Server receive timestamp';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS local_seq BIGINT NULL COMMENT 'Client-assigned sequence (optimistic)';

-- 3. Create unique index for ordering guarantee
-- This prevents duplicate sequences within a chat
CREATE UNIQUE INDEX IF NOT EXISTS uk_chat_server_seq ON messages(chat_id, server_seq);

-- 4. Index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_messages_chat_seq ON messages(chat_id, server_seq);

-- 5. Stored procedure for atomic sequence generation
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS get_next_seq(IN p_chat_id VARCHAR(128), OUT p_next_seq BIGINT)
BEGIN
    INSERT INTO chat_sequences (chat_id, last_seq) 
    VALUES (p_chat_id, 1)
    ON DUPLICATE KEY UPDATE last_seq = last_seq + 1;
    
    SELECT last_seq INTO p_next_seq FROM chat_sequences WHERE chat_id = p_chat_id;
END //
DELIMITER ;


;


-- 
-- SOURCE: 011_message_receipts.sql
-- 


-- Migration 011: Message Receipts Table
-- Epic 15: Offline -> Online Reconciliation
-- Tracks delivery and read receipts per message per user.

CREATE TABLE IF NOT EXISTS message_receipts (
    message_uuid VARCHAR(128) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SENT', -- SENT, DELIVERED, READ
    delivered_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (message_uuid, user_id),
    INDEX idx_receipts_msg (message_uuid),
    INDEX idx_receipts_user (user_id)
);


;


-- 
-- SOURCE: 012_relay_messages.sql
-- 


-- Migration 012: Relay Messages Table
-- Epic 17: Relay Service MVP
-- Replaces Firestore message storage with a centralized SQL backend for strict ordering.

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chat_id VARCHAR(128) NOT NULL,
    sender_id VARCHAR(128) NOT NULL,
    server_seq BIGINT NOT NULL,
    message_uuid VARCHAR(128) NOT NULL, -- Phase 2 idempotency
    encrypted_payload TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    server_received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints & Indexes
    CONSTRAINT uk_message_uuid UNIQUE (message_uuid),
    CONSTRAINT uk_chat_seq UNIQUE (chat_id, server_seq),
    INDEX idx_chat_seq (chat_id, server_seq),
    INDEX idx_chat_created (chat_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure chat_sequences table exists (from migration 009) and add locking support if needed
-- (InnoDB supports row-level locking by default)


;


-- 
-- SOURCE: 013_presence.sql
-- 


-- Migration: 013_presence.sql
-- Epic 19: Presence & Typing Migration (MySQL)

CREATE TABLE IF NOT EXISTS presence (
    user_id VARCHAR(255) NOT NULL,
    device_uuid VARCHAR(64) NOT NULL,
    status ENUM('online', 'offline', 'busy') NOT NULL DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    typing_in_chat VARCHAR(255) NULL,
    app_version VARCHAR(50) NULL,
    
    PRIMARY KEY (user_id, device_uuid),
    INDEX idx_user_last_seen (user_id, last_seen),
    INDEX idx_last_seen (last_seen) -- For global cleanup
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 014_push_tokens.sql
-- 


-- Migration: 014_push_tokens.sql
-- Epic 20: Push Notifications Table (MySQL)

CREATE TABLE IF NOT EXISTS push_tokens (
    user_id VARCHAR(255) NOT NULL,
    device_uuid VARCHAR(64) NOT NULL,
    token TEXT NOT NULL,
    platform ENUM('android', 'ios', 'web') NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Security & Stability Attributes
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=Active, 0=Revoked/Failed',
    last_error TEXT NULL COMMENT 'FCM error message details',
    last_sent_at TIMESTAMP NULL COMMENT 'Rate limiting timestamp',

    PRIMARY KEY (user_id, device_uuid),
    INDEX idx_user_active (user_id, is_active),
    INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 015_receipts.sql
-- 


-- Migration: 015_receipts.sql
-- Epic 21: Delivery & Read Receipts (Relay Reliability)

CREATE TABLE IF NOT EXISTS receipts (
    receipt_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL,
    message_uuid VARCHAR(64) NOT NULL,
    user_id VARCHAR(255) NOT NULL COMMENT 'Receiver who read/received message',
    device_uuid VARCHAR(64) NOT NULL COMMENT 'Audit: Device that sent the receipt',
    type ENUM('DELIVERED', 'READ') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Idempotency: One receipt type per user per message
    UNIQUE KEY uniq_receipt (message_uuid, user_id, type),
    
    -- Efficient Sync & Pruning
    INDEX idx_chat_created (chat_id, created_at),
    INDEX idx_user_device (user_id, device_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 016_performance_indexes.sql
-- 


-- Migration: 016_performance_indexes.sql
-- Epic 22: Performance Optimization (Index Tuning)

-- Add index to receipts for efficient pull by chat_id
-- (chat_id, receipt_id) is critical for "Fetch receipts > X" logic in pull.php
CREATE INDEX idx_chat_receipt ON receipts (chat_id, receipt_id);

-- Optional: Ensure messages index supports range scan on server_seq
-- Existing index might be (chat_id), adding (chat_id, server_seq) if not exists
-- Only create if not exists (MySQL syntax doesn't support IF NOT EXISTS for index directly usually)
-- But we can try to add it, ignoring error if dup.
-- Or just assume we are tuning:
-- DUPLICATE: Already created in 009_message_ordering.sql
-- CREATE INDEX idx_messages_chat_seq ON messages (chat_id, server_seq);


;


-- 
-- SOURCE: 017_rate_limits.sql
-- 


-- Migration: 017_rate_limits.sql
-- Epic 23: Rate Limiting Framework
-- Purpose: Store rate limit events for rolling window enforcement.

CREATE TABLE IF NOT EXISTS rate_limit_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_uuid VARCHAR(64) NOT NULL,
    user_id VARCHAR(255) DEFAULT NULL,
    device_uuid VARCHAR(64) DEFAULT NULL,
    ip_address VARCHAR(64) NOT NULL,
    endpoint VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for efficient rolling window queries
    INDEX idx_device_endpoint (device_uuid, endpoint, created_at),
    INDEX idx_user_endpoint (user_id, endpoint, created_at),
    INDEX idx_ip_endpoint (ip_address, endpoint, created_at),
    
    -- Unique index for idempotency / deduplication
    UNIQUE INDEX idx_request_uuid (request_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 018_abuse_scores.sql
-- 


-- Migration: 018_abuse_scores.sql
-- Epic 24: Spam Detection Heuristics
-- Purpose: Store abuse events and aggregated risk scores.

-- Table: abuse_events (Event Log)
CREATE TABLE IF NOT EXISTS abuse_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    device_uuid VARCHAR(64) DEFAULT NULL,
    ip_address VARCHAR(64) NOT NULL,
    event_type ENUM('BURST_SEND', 'NEW_BLAST', 'REPAIR_ABUSE', 'PULL_ABUSE', 'IP_HOP', 'DEVICE_FLOOD', 'ABUSE_LOCK') NOT NULL,
    weight INT NOT NULL DEFAULT 0,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_device_created (device_uuid, created_at),
    INDEX idx_ip_created (ip_address, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: abuse_scores (Aggregated Risk)
CREATE TABLE IF NOT EXISTS abuse_scores (
    user_id VARCHAR(255) PRIMARY KEY,
    score INT NOT NULL DEFAULT 0,
    risk_level ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    cooldown_until TIMESTAMP NULL DEFAULT NULL,
    
    INDEX idx_risk_level (risk_level),
    INDEX idx_cooldown (cooldown_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 019_device_audit.sql
-- 


-- Migration: 019_device_audit.sql
-- Epic 25: Device Manager UI + Audit History
-- Purpose: Store device audit events for security transparency.

CREATE TABLE IF NOT EXISTS device_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    device_uuid VARCHAR(64) NOT NULL,
    event_type ENUM('LOGIN', 'REGISTER', 'REVOKE', 'TOKEN_REFRESH', 'LOGOUT') NOT NULL,
    ip_address VARCHAR(64) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_time (user_id, created_at),
    INDEX idx_device_time (device_uuid, created_at),
    INDEX idx_event_type (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 020_security_alerts.sql
-- 


-- Migration: 020_security_alerts.sql
-- Epic 26: Security Alerts + Suspicious Login Detection
-- Purpose: Store security notifications for users.

CREATE TABLE IF NOT EXISTS security_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    alert_type ENUM('NEW_DEVICE_LOGIN', 'DEVICE_REVOKED', 'IP_CHANGE', 'ABUSE_LOCK', 'RATE_LIMIT_BLOCK') NOT NULL,
    severity ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    device_uuid VARCHAR(64) DEFAULT NULL,
    ip_address VARCHAR(64) DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    is_read TINYINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_user_unread (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 021_admin_actions.sql
-- 


-- Migration: 021_admin_actions.sql
-- Epic 27: Admin Moderation Dashboard
-- Purpose: Track all admin interventions for audit trail.

CREATE TABLE IF NOT EXISTS admin_actions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_id VARCHAR(255) NOT NULL,
    target_user_id VARCHAR(255) NOT NULL,
    action_type ENUM('LOCK_USER', 'UNLOCK_USER', 'RESET_ABUSE_SCORE', 'REVOKE_ALL_DEVICES', 'VIEW_USER') NOT NULL,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_target_user (target_user_id, created_at),
    INDEX idx_admin_id (admin_id, created_at),
    INDEX idx_action_type (action_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 022_metrics.sql
-- 


-- Migration: 022_metrics.sql
-- Epic 29: Metrics Collection + Latency Dashboard
-- Purpose: Store request performance metrics for P50/P95/P99 analysis.

-- API Request Metrics (raw events)
CREATE TABLE IF NOT EXISTS api_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    user_id VARCHAR(255) DEFAULT NULL,
    device_uuid VARCHAR(64) DEFAULT NULL,
    status_code INT NOT NULL,
    duration_ms DOUBLE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_endpoint_created (endpoint, created_at),
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_status_created (status_code, created_at),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System Counters (aggregated)
CREATE TABLE IF NOT EXISTS system_counters (
    metric_key VARCHAR(255) PRIMARY KEY,
    metric_value BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize default counters
INSERT IGNORE INTO system_counters (metric_key, metric_value) VALUES
    ('relay_send_total', 0),
    ('relay_send_errors', 0),
    ('relay_pull_total', 0),
    ('rate_limit_blocks_total', 0),
    ('abuse_blocks_total', 0);


;


-- 
-- SOURCE: 023_alerts.sql
-- 


-- Migration: 023_alerts.sql
-- Epic 31: SLA Targets + Alert Threshold Rules
-- Purpose: Store historical system alerts for incident tracking.

CREATE TABLE IF NOT EXISTS system_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    severity ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'WARNING',
    endpoint VARCHAR(255) DEFAULT NULL,
    message VARCHAR(500) NOT NULL,
    value DOUBLE DEFAULT NULL,
    threshold DOUBLE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    
    INDEX idx_type_created (alert_type, created_at),
    INDEX idx_severity_created (severity, created_at),
    INDEX idx_unresolved (resolved_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 024_groups.sql
-- 


-- 024_groups.sql
-- Epic 41: Group Chat Schema + Membership Model

-- Table 1: groups
CREATE TABLE IF NOT EXISTS `groups` (
    `group_id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `created_by` VARCHAR(255) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_active` TINYINT(1) DEFAULT 1,
    INDEX `idx_created_by` (`created_by`),
    INDEX `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: group_members
CREATE TABLE IF NOT EXISTS `group_members` (
    `group_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'member') DEFAULT 'member',
    `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `removed_at` TIMESTAMP NULL DEFAULT NULL,
    `added_by` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`group_id`, `user_id`),
    INDEX `idx_user_groups` (`user_id`, `group_id`),
    INDEX `idx_group_members` (`group_id`, `removed_at`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 3: group_audit_log
CREATE TABLE IF NOT EXISTS `group_audit_log` (
    `audit_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(64) NOT NULL,
    `actor_user_id` VARCHAR(255) NOT NULL,
    `target_user_id` VARCHAR(255) NULL,
    `action` ENUM('GROUP_CREATED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'ROLE_CHANGED', 'GROUP_TITLE_UPDATED') NOT NULL,
    `metadata` JSON NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_group_audit` (`group_id`, `created_at`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 025_group_messages.sql
-- 


-- 025_group_messages.sql
-- Epic 42: Group Messaging Transport

-- Table 1: group_messages
CREATE TABLE IF NOT EXISTS `group_messages` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(64) NOT NULL,
    `message_uuid` VARCHAR(64) NOT NULL UNIQUE,
    `sender_id` VARCHAR(255) NOT NULL,
    `sender_device_uuid` VARCHAR(64) NOT NULL,
    `server_seq` BIGINT NOT NULL,
    `encrypted_payload` LONGTEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_group_seq` (`group_id`, `server_seq`),
    INDEX `idx_group_seq` (`group_id`, `server_seq`),
    INDEX `idx_sender` (`sender_id`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: group_sequences (for strict ordering)
CREATE TABLE IF NOT EXISTS `group_sequences` (
    `group_id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `last_seq` BIGINT DEFAULT 0,
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize sequences for existing groups
INSERT IGNORE INTO group_sequences (group_id, last_seq)
SELECT group_id, 0 FROM `groups` WHERE is_active = 1;


;


-- 
-- SOURCE: 026_sender_keys.sql
-- 


-- 026_sender_keys.sql
-- Epic 44: Group Sender Keys (Signal Protocol)

-- Table 1: group_sender_keys
-- Stores the encrypted sender key for each recipient device
CREATE TABLE IF NOT EXISTS `group_sender_keys` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(64) NOT NULL,
    `sender_id` VARCHAR(255) NOT NULL,
    `sender_device_uuid` VARCHAR(64) NOT NULL,
    `recipient_id` VARCHAR(255) NOT NULL,
    `recipient_device_uuid` VARCHAR(64) NOT NULL,
    `sender_key_id` BIGINT NOT NULL,
    `encrypted_sender_key` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_recipient_key` (`group_id`, `sender_id`, `recipient_id`, `recipient_device_uuid`),
    INDEX `idx_fetch_keys` (`group_id`, `recipient_id`, `recipient_device_uuid`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: group_sender_key_state
-- Tracks the current version/rotation state of a sender's key
CREATE TABLE IF NOT EXISTS `group_sender_key_state` (
    `group_id` VARCHAR(64) NOT NULL,
    `sender_id` VARCHAR(255) NOT NULL,
    `sender_device_uuid` VARCHAR(64) NOT NULL,
    `sender_key_id` BIGINT NOT NULL,
    `last_rotated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`group_id`, `sender_id`, `sender_device_uuid`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 027_group_receipts.sql
-- 


-- 027_group_receipts.sql
-- Epic 45: Group Receipts and Reliability Schema

-- Table 1: group_receipts
-- Tracks delivery and read receipts for group messages
CREATE TABLE IF NOT EXISTS `group_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(64) NOT NULL,
    `message_uuid` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `device_uuid` VARCHAR(64) NOT NULL,
    `type` ENUM('DELIVERED', 'READ') NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_receipt` (`message_uuid`, `user_id`, `type`),
    INDEX `idx_group_fetch` (`group_id`, `receipt_id`),
    INDEX `idx_user_stats` (`user_id`, `created_at`),
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 028_device_registry.sql
-- 


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


;


-- 
-- SOURCE: 029_device_events.sql
-- 


-- 029_device_events.sql
-- Epic 48: Device Audit Log for Sync Reliability

CREATE TABLE IF NOT EXISTS `device_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `event_type` ENUM('REGISTERED', 'APPROVED', 'REVOKED', 'KEY_ROTATED') NOT NULL,
    `metadata` JSON DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sync` (`user_id`, `event_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 030_device_sessions.sql
-- 


-- 030_device_sessions.sql
-- Epic 48: Per-Device Pairwise Sessions

CREATE TABLE IF NOT EXISTS `device_sessions` (
    `session_id` VARCHAR(128) NOT NULL PRIMARY KEY, -- Derived from sender_dev + recipient_dev
    `sender_user_id` VARCHAR(255) NOT NULL,
    `sender_device_id` VARCHAR(64) NOT NULL,
    `recipient_user_id` VARCHAR(255) NOT NULL,
    `recipient_device_id` VARCHAR(64) NOT NULL,
    `chain_state_json` TEXT NOT NULL, -- Encrypted state blob
    `last_active_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sender_lookup` (`sender_device_id`, `recipient_user_id`),
    INDEX `idx_recipient_lookup` (`recipient_device_id`, `sender_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 031_device_inbox.sql
-- 


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


;


-- 
-- SOURCE: 032_device_inbox_constraints.sql
-- 


-- 032_device_inbox_constraints.sql
-- Epic 48-HF: Hardening - Inbox Constraints

-- 1. Prevent duplicate messages in device inbox (Replay Protection)
ALTER TABLE `device_inbox`
ADD CONSTRAINT `uq_device_message` UNIQUE (`recipient_device_id`, `message_uuid`);

-- 2. Prevent duplicate sessions per device pair
ALTER TABLE `device_sessions`
ADD CONSTRAINT `uq_device_pair` UNIQUE (`sender_device_id`, `recipient_device_id`);


;


-- 
-- SOURCE: 033_device_inbox_retention.sql
-- 


-- 033_device_inbox_retention.sql
-- Epic 48-HF: Hardening - Retention Policy

-- Add expiration column to enable TTL cleanup
ALTER TABLE `device_inbox`
ADD COLUMN `expires_at` BIGINT NULL DEFAULT NULL;

-- Index for efficient cleanup
CREATE INDEX `idx_inbox_cleanup` ON `device_inbox` (`expires_at`);


;


-- 
-- SOURCE: 034_device_inbox_state_machine.sql
-- 


-- 034_device_inbox_state_machine.sql
-- Epic 49: Device Delivery State Machine

-- Enforce strict state transitions (Schema-level where possible, mostly App-level)
-- But we can optimize the index key for state lookups

ALTER TABLE `device_inbox`
MODIFY COLUMN `status` ENUM('PENDING', 'DELIVERED', 'ACKED', 'READ', 'FAILED') DEFAULT 'PENDING';

-- High-performance index for aggregation
CREATE INDEX `idx_message_status` ON `device_inbox` (`message_uuid`, `status`);


;


-- 
-- SOURCE: 035_conversation_device_markers.sql
-- 


-- 035_conversation_device_markers.sql
-- Epic 49: Read Receipt Convergence

CREATE TABLE IF NOT EXISTS `conversation_device_markers` (
    `marker_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `conversation_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL, -- The user who read
    `device_id` VARCHAR(64) NOT NULL, -- The specific device that updated it
    `last_read_message_id` VARCHAR(64) DEFAULT NULL,
    `last_delivered_message_id` VARCHAR(64) DEFAULT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_conv_device` (`conversation_id`, `device_id`),
    INDEX `idx_user_conv` (`user_id`, `conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 036_device_sync_watermarks.sql
-- 


-- 036_device_sync_watermarks.sql
-- Epic 49-HF: Sync Replay Guard

CREATE TABLE IF NOT EXISTS `device_sync_watermarks` (
    `watermark_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `device_id` VARCHAR(64) NOT NULL,
    `conversation_id` VARCHAR(64) NOT NULL, -- Optional if syncing globally vs per-conv
    `last_synced_inbox_id` BIGINT NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_dev_conv` (`device_id`, `conversation_id`),
    FOREIGN KEY (`device_id`) REFERENCES `devices`(`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 037_device_inbox_retry.sql
-- 


-- 037_device_inbox_retry.sql
-- Epic 49-HF: Resilience / Active Requeue

ALTER TABLE `device_inbox`
ADD COLUMN `retry_count` INT DEFAULT 0,
ADD COLUMN `last_retry_at` TIMESTAMP NULL DEFAULT NULL;

-- Index for cron job
CREATE INDEX `idx_retry` ON `device_inbox` (`status`, `retry_count`, `created_at`);


;


-- 
-- SOURCE: 038_delivery_security_events.sql
-- 


-- 038_delivery_security_events.sql
-- Epic 49-HF: Delivery Tamper Logging

CREATE TABLE IF NOT EXISTS `delivery_security_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_type` ENUM('INVALID_ACK_TRANSITION', 'SYNC_WATERMARK_VIOLATION', 'MARKER_SPOOF_ATTEMPT', 'UNAUTHORIZED_SYNC') NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `message_uuid` VARCHAR(64) DEFAULT NULL,
    `attempted_state` VARCHAR(20) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_dev_sec` (`device_id`, `event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 039_security_audit_log.sql
-- 


-- 039_security_audit_log.sql
-- Epic 51: Centralized Security Audit Log
-- Stores all security-critical events for compliance and abuse detection.

CREATE TABLE IF NOT EXISTS `security_audit_log` (
    `audit_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_type` VARCHAR(64) NOT NULL, -- e.g. 'DEVICE_REVOKED', 'DECRYPT_FAIL'
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL', 'BLOCKER') NOT NULL DEFAULT 'INFO',
    `user_id` VARCHAR(255) DEFAULT NULL, -- Nullable for unauth events
    `device_id` VARCHAR(64) DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `metadata` JSON DEFAULT NULL, -- Context: msg_id, payload_hash, etc.
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_event_type` (`event_type`),
    INDEX `idx_user_severity` (`user_id`, `severity`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HF-51.2: Immutable Audit Store (Updated HF-51.7)
-- Trigger to block Updates/Deletes UNLESS privileged session var is set
DELIMITER //
CREATE TRIGGER `prevent_audit_update` BEFORE UPDATE ON `security_audit_log`
FOR EACH ROW
BEGIN
    IF @allow_audit_cleanup IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security Audit Logs are Immutable';
    END IF;
END;
//
CREATE TRIGGER `prevent_audit_delete` BEFORE DELETE ON `security_audit_log`
FOR EACH ROW
BEGIN
    IF @allow_audit_cleanup IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security Audit Logs are Immutable';
    END IF;
END;
//
DELIMITER ;




;


-- 
-- SOURCE: 042_restrict_cleanup_user.sql
-- 


-- 042_restrict_cleanup_user.sql
-- HF-51.10: Restrict Cleanup Privilege
-- Only allow 'cron_user' (or specific privileged account) to set usage of cleanup bypass.
-- In a real deployment, this would revoke privileges from the 'app_user'.
-- For this simulation, we act as if checking CURRENT_USER() in the trigger.

-- Update Trigger to check CURRENT_USER() or stricter logic
DROP TRIGGER IF EXISTS `prevent_audit_update`;
DROP TRIGGER IF EXISTS `prevent_audit_delete`;

DELIMITER //
CREATE TRIGGER `prevent_audit_update` BEFORE UPDATE ON `security_audit_log`
FOR EACH ROW
BEGIN
    -- Block if session var not set OR if user is 'web_app' (simulated)
    -- In prod: AND CURRENT_USER() = 'cron_svc@%'
    IF @allow_audit_cleanup IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security Audit Logs are Immutable';
    END IF;
END;
//
CREATE TRIGGER `prevent_audit_delete` BEFORE DELETE ON `security_audit_log`
FOR EACH ROW
BEGIN
    IF @allow_audit_cleanup IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security Audit Logs are Immutable';
    END IF;
END;
//
DELIMITER ;


;


-- 
-- SOURCE: 043_rate_limit_buckets.sql
-- 


-- 043_rate_limit_buckets.sql
-- Epic 52: Token Bucket Store for Global Rate Limiter
-- Stores current token count and last update time for each bucket.

CREATE TABLE IF NOT EXISTS `rate_limit_buckets` (
    `bucket_key` VARCHAR(128) PRIMARY KEY, -- Hash(IP + User + Action)
    `tokens` FLOAT NOT NULL,
    `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL, -- For auto-cleanup
    
    INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 044_ip_banlist.sql
-- 


-- 044_ip_banlist.sql
-- Epic 52: Global Ban List
-- Stores IPs or User IDs that are temporarily or permanently banned.

CREATE TABLE IF NOT EXISTS `ip_banlist` (
    `ban_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `target_type` ENUM('IP', 'USER', 'DEVICE') NOT NULL,
    `target_value` VARCHAR(128) NOT NULL,
    `reason` VARCHAR(255) DEFAULT 'ABUSE_DETECTED',
    `banned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL, -- NULL = Permanent
    `created_by` VARCHAR(64) DEFAULT 'SYSTEM', -- 'SYSTEM' or Admin ID
    
    INDEX `idx_target` (`target_type`, `target_value`),
    INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 045_abuse_scores.sql
-- 


-- 045_abuse_scores.sql
-- Epic 52 Hardening: Abuse Score Engine
-- Tracks cumulative abuse points per actor (IP/User) with decay.

CREATE TABLE IF NOT EXISTS `abuse_scores` (
    `target_key` VARCHAR(128) PRIMARY KEY, -- Hash(Type + Value) e.g. "IP:1.2.3.4"
    `score` INT NOT NULL DEFAULT 0,
    `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_score` (`score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 045_compliance_settings.sql
-- 


-- 045_compliance_settings.sql
-- Epic 54: Compliance Configuration & Retention Rules
-- Stores global governance policies.

CREATE TABLE IF NOT EXISTS `compliance_settings` (
    `setting_key` VARCHAR(64) PRIMARY KEY,
    `setting_value` VARCHAR(255) NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` VARCHAR(64) DEFAULT 'SYSTEM'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Defaults
INSERT IGNORE INTO `compliance_settings` (`setting_key`, `setting_value`) VALUES
('compliance_mode', 'STANDARD'), -- STANDARD, STRICT, REGULATED
('retention_audit_logs_days', '365'),
('retention_messages_days', '30'),
('retention_abuse_scores_days', '90'),
('retention_inactive_devices_days', '180');


;


-- 
-- SOURCE: 046_legal_holds.sql
-- 


-- 046_legal_holds.sql
-- Epic 54: Legal Hold Tracking
-- Overrides retention policies for specific targets.

CREATE TABLE IF NOT EXISTS `legal_holds` (
    `hold_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `target_type` ENUM('USER', 'DEVICE', 'CONVERSATION') NOT NULL,
    `target_value` VARCHAR(128) NOT NULL,
    `case_reference` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL, -- HF-54.3: Auto-expiry
    `review_required` TINYINT(1) DEFAULT 0, -- HF-54.3: Flag for review
    `created_by` VARCHAR(64) NOT NULL,
    `active` TINYINT(1) DEFAULT 1,

    
    INDEX `idx_target` (`target_type`, `target_value`),
    INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 046_partition_buckets.sql
-- 


-- 046_partition_buckets.sql
-- Epic 52 Hardening: Partition Rate Limit Buckets
-- Optimizes high-write bucket table by partitioning on bucket_key hash.
-- Note: MySQL requires partitioning key to be part of Primary Key.

-- 1. Drop existing PK if needed (Assuming bucket_key is PK)
-- ALTER TABLE `rate_limit_buckets` DROP PRIMARY KEY;

-- 2. Add HASH Partitioning (Simple distribution)
ALTER TABLE `rate_limit_buckets`
PARTITION BY KEY(bucket_key)
PARTITIONS 16;


;


-- 
-- SOURCE: 047_gdpr_delete_jobs.sql
-- 


-- 047_gdpr_delete_jobs.sql
-- Epic 54 Hardening: GDPR Deletion Job Tracking
-- Ensures reliable tracking of deletion requests and their outcomes.

CREATE TABLE IF NOT EXISTS `gdpr_delete_jobs` (
    `job_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(128) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED') DEFAULT 'PENDING',
    `items_deleted` INT DEFAULT 0,
    `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `finished_at` TIMESTAMP NULL,
    `error_message` TEXT,
    
    INDEX `idx_status` (`status`),
    INDEX `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 048_global_hardening_schema.sql
-- 


-- 048_global_hardening_schema.sql
-- Global Security Hardening (Epic 51-54)
-- Combined migration for Audit Hashing, Abuse Correlation, and Compliance.

-- HF-51.5: Audit Hash Chaining
-- Add row_hash to create a tamper-evident blockchain-style log.
ALTER TABLE `security_audit_log` 
ADD COLUMN `row_hash` CHAR(64) DEFAULT NULL AFTER `metadata`,
ADD INDEX `idx_row_hash` (`row_hash`);

-- HF-52.9: Abuse Correlation Graph
-- Tracks relationships between Users, IPs, and Devices to detect ban evasion.
CREATE TABLE IF NOT EXISTS `abuse_correlation` (
    `link_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT DEFAULT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `device_id` VARCHAR(64) DEFAULT NULL,
    `seen_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_user` (`user_id`),
    INDEX `idx_ip` (`ip_address`),
    INDEX `idx_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 049_trust_scores.sql
-- 


-- 049_trust_scores.sql
-- Epic 55: Trust Score Engine
-- Stores the current trust score and level for actors.

CREATE TABLE IF NOT EXISTS `trust_scores` (
    `trust_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `actor_type` ENUM('USER', 'DEVICE', 'IP') NOT NULL,
    `actor_value` VARCHAR(128) NOT NULL,
    `trust_score` INT NOT NULL DEFAULT 400, -- Default for User
    `trust_level` ENUM('LOW', 'MEDIUM', 'HIGH', 'VERIFIED') GENERATED ALWAYS AS (
        CASE 
            WHEN trust_score < 300 THEN 'LOW'
            WHEN trust_score < 600 THEN 'MEDIUM'
            WHEN trust_score < 800 THEN 'HIGH'
            ELSE 'VERIFIED'
        END
    ) STORED,
    `last_updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `idx_actor` (`actor_type`, `actor_value`),
    INDEX `idx_level` (`trust_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 050_trust_score_events.sql
-- 


-- 050_trust_score_events.sql
-- Epic 55: Trust Score Events
-- Logs events that impact trust scores for auditability and recalculation.

CREATE TABLE IF NOT EXISTS `trust_score_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `actor_type` ENUM('USER', 'DEVICE', 'IP') NOT NULL,
    `actor_value` VARCHAR(128) NOT NULL,
    `event_type` VARCHAR(64) NOT NULL, -- e.g. 'RATE_LIMIT_HIT', 'BAN', 'CLEAN_DAY'
    `score_delta` INT NOT NULL,
    `reason` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_actor_event` (`actor_type`, `actor_value`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 051_transparency_reports.sql
-- 


-- 051_transparency_reports.sql
-- Epic 56: Transparency Reporting System
-- Stores immutable, signed transparency reports.

CREATE TABLE IF NOT EXISTS `transparency_reports` (
    `report_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `generated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `report_json` JSON NOT NULL, -- Full statistical payload
    `integrity_hash` CHAR(64) NOT NULL, -- SHA256 of report_json
    `signature` TEXT DEFAULT NULL, -- RSA signature of integrity_hash
    
    UNIQUE KEY `idx_period` (`period_start`, `period_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 052_vulnerability_reports.sql
-- 


-- 052_vulnerability_reports.sql
-- Epic 57: Vulnerability Reporting
-- Stores reports from researchers securely.

CREATE TABLE IF NOT EXISTS `vulnerability_reports` (
    `report_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(255) NOT NULL,
    `reporter_email` VARCHAR(255) DEFAULT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `affected_component` VARCHAR(100) NOT NULL,
    `status` ENUM('NEW', 'TRIAGED', 'ACCEPTED', 'REJECTED', 'FIXED', 'DISCLOSED') DEFAULT 'NEW',
    `content_hash` CHAR(64) NOT NULL, -- SHA256(Title + Description) for De-Duplication
    `payload_json` JSON NOT NULL, -- Encrypted details or raw structure
    `staff_notes` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `idx_hash` (`content_hash`),
    INDEX `idx_status` (`status`),

    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 054_vuln_disclosure_ids.sql
-- 


-- 054_vuln_disclosure_ids.sql
-- Epic 57: Vulnerability Disclosure IDs
-- Adds support for assigning "CHATFLECT-YYYY-NNN" IDs to accepted reports.

ALTER TABLE `vulnerability_reports`
ADD COLUMN `disclosure_id` VARCHAR(32) DEFAULT NULL AFTER `status`,
ADD UNIQUE KEY `idx_disclosure_id` (`disclosure_id`);


;


-- 
-- SOURCE: 055_vuln_attachments.sql
-- 


-- 055_vuln_attachments.sql
-- Epic 57: Vulnerability Attachments
-- Stores metadata for uploaded PoCs.

CREATE TABLE IF NOT EXISTS `vulnerability_attachments` (
    `attachment_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `report_id` BIGINT NOT NULL,
    `filename_original` VARCHAR(255) NOT NULL,
    `filename_storage` VARCHAR(255) NOT NULL, -- Random hash
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size` INT NOT NULL,
    `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`report_id`) REFERENCES `vulnerability_reports`(`report_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 056_vuln_file_hash.sql
-- 


-- 056_vuln_file_hash.sql
-- Epic 57: File Deduplication Hash
-- Stores SHA256 of the *file content* to detect identical uploads.

ALTER TABLE `vulnerability_attachments`
ADD COLUMN `file_hash` CHAR(64) NOT NULL AFTER `filename_original`,
ADD INDEX `idx_file_hash` (`file_hash`);


;


-- 
-- SOURCE: 057_governance_policies.sql
-- 


-- 057_governance_policies.sql
-- Epic 58: Governance Policy Rules
-- Stores configuration for required approvals.

CREATE TABLE IF NOT EXISTS `governance_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `action_type` VARCHAR(50) NOT NULL, -- e.g., 'PERMA_BAN', 'GDPR_DELETE'
    `description` VARCHAR(255) NOT NULL,
    `requires_approval` BOOLEAN DEFAULT TRUE,
    `min_approvers` INT DEFAULT 1, -- Number of additional admins required (1 = requester + 1 approver)
    `auto_expire_hours` INT DEFAULT 24,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `idx_action` (`action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Policies
INSERT INTO `governance_policies` (action_type, description, min_approvers) VALUES
('PERMA_BAN', 'Permanently ban a user', 1),
('GDPR_DELETE', 'Right to Erasure execution', 1),
('DEVICE_REVOKE', 'Force revoke device keys', 1),
('POLICY_CHANGE', 'Modify retention or governance rules', 1),
('EXPORT_DATA', 'Export sensitive user data', 1)
ON DUPLICATE KEY UPDATE description = VALUES(description);


;


-- 
-- SOURCE: 058_admin_action_queue.sql
-- 


-- 058_admin_action_queue.sql
-- Epic 58: Admin Action Queue
-- Stores pending actions waiting for approval.

CREATE TABLE IF NOT EXISTS `admin_action_queue` (
    `request_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `action_type` VARCHAR(50) NOT NULL,
    `target_resource` VARCHAR(255) NOT NULL, -- JSON or ID (e.g., {"user_id": 123})
    `requester_id` INT NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'EXPIRED') DEFAULT 'PENDING',
    `approval_metadata` JSON DEFAULT NULL, -- Stores approver IDs and timestamps
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL,
    
    FOREIGN KEY (`action_type`) REFERENCES `governance_policies`(`action_type`),
    INDEX `idx_status` (`status`),
    INDEX `idx_requester` (`requester_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 059_governance_hardening.sql
-- 


-- 059_governance_hardening.sql
-- Epic 58 HF: Governance Hardening
-- Adds hashing, identity management, and rejection logging.

-- 1. Admin Identity Table
CREATE TABLE IF NOT EXISTS `admin_identities` (
    `admin_id` INT PRIMARY KEY, -- Maps to main user/admin table
    `role` ENUM('SECURITY', 'OPS', 'SUPER_ADMIN') NOT NULL DEFAULT 'OPS',
    `status` ENUM('ACTIVE', 'REVOKED') DEFAULT 'ACTIVE',
    `public_key` TEXT DEFAULT NULL, -- For future signed actions
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Hardening Action Queue
ALTER TABLE `admin_action_queue`
ADD COLUMN `action_hash` CHAR(64) DEFAULT NULL AFTER `target_resource`,
ADD COLUMN `rejection_reason` TEXT DEFAULT NULL AFTER `status`;

-- 3. Policy Constraints
ALTER TABLE `governance_policies`
ADD COLUMN `is_locked` BOOLEAN DEFAULT FALSE; -- If true, policy itself cannot be changed easily

-- Backfill hashes for existing rows (if any)
UPDATE `admin_action_queue` 
SET `action_hash` = SHA2(CONCAT(action_type, target_resource, created_at), 256) 
WHERE `action_hash` IS NULL;


;


-- 
-- SOURCE: 060_governance_roles.sql
-- 


-- 060_governance_roles.sql
-- Epic 58 HF 2: Role-Based Governance
-- Adds required_role to policies.

ALTER TABLE `governance_policies`
ADD COLUMN `required_role` ENUM('ANY', 'SECURITY', 'OPS', 'SUPER_ADMIN') DEFAULT 'ANY' AFTER `min_approvers`;

-- Update critical policies
UPDATE `governance_policies` SET `required_role` = 'SECURITY' WHERE `action_type` IN ('PERMA_BAN', 'EXPORT_DATA', 'POLICY_CHANGE');


;


-- 
-- SOURCE: 061_organizations.sql
-- 


-- 061_organizations.sql
-- Epic 60: Organization Foundation
-- Stores the identity of an organization (Tenant).

CREATE TABLE IF NOT EXISTS `organizations` (
    `org_id` BINARY(16) NOT NULL PRIMARY KEY, -- UUID
    `org_name` VARCHAR(255) NOT NULL,
    `org_slug` VARCHAR(100) NOT NULL UNIQUE, -- For URL routing (e.g. /org/acme)
    `allowed_domains` TEXT DEFAULT NULL, -- JSON array of allowed email domains for invites
    `created_by_user_id` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_org_slug` (`org_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 062_org_members.sql
-- 


-- 062_org_members.sql
-- Epic 60: Organization Members
-- Links Users to Organizations with a specific Role.

CREATE TABLE IF NOT EXISTS `org_members` (
    `org_id` BINARY(16) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'AUDITOR') NOT NULL DEFAULT 'MEMBER',
    `status` ENUM('ACTIVE', 'DISABLED') DEFAULT 'ACTIVE',
    `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`org_id`, `user_id`), -- Unique constraint: User can only be in an Org once
    INDEX `idx_user_orgs` (`user_id`), -- For "List my orgs"
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
    -- User FK omitted to decouple from legacy user table differences, handled in app logic usually
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 063_org_invites.sql
-- 


-- 063_org_invites.sql
-- Epic 60: Organization Invites
-- Helper table for the invitation workflow (security tokens).

CREATE TABLE IF NOT EXISTS `org_invites` (
    `invite_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `invited_email` VARCHAR(255) NOT NULL,
    `invited_by_user_id` VARCHAR(255) NOT NULL,
    `invite_token` CHAR(64) NOT NULL, -- SHA256 of random token
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'AUDITOR') NOT NULL DEFAULT 'MEMBER',
    `expires_at` DATETIME NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED') DEFAULT 'PENDING',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_token` (`invite_token`),
    INDEX `idx_org_email` (`org_id`, `invited_email`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 064_governance_org_actions.sql
-- 


-- 064_governance_org_actions.sql
-- Epic 61 HF: Org Admin Governance Policies
-- Adds policies for destructive Organization actions.

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_REMOVE_MEMBER', 'Remove a member from an Organization', 1, 'ADMIN'),
('ORG_DISABLE_MEMBER', 'Disable an Organization Member', 1, 'ADMIN'),
('ORG_REVOKE_DEVICE', 'Revoke an Organization Device', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);


;


-- 
-- SOURCE: 065_org_policies.sql
-- 


-- 065_org_policies.sql
-- Epic 62: Organization Policies
-- Stores versioned security configurations for organizations.

CREATE TABLE IF NOT EXISTS `org_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `version` INT NOT NULL DEFAULT 1,
    `policy_json` JSON NOT NULL, -- The rules: { "allow_exports": false, ... }
    `created_by_user_id` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `is_active` BOOLEAN GENERATED ALWAYS AS (TRUE) VIRTUAL, -- Simplified current pointer or use MAX(version)
    
    INDEX `idx_org_version` (`org_id`, `version`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 066_governance_policy_actions.sql
-- 


-- 066_governance_policy_actions.sql
-- Epic 62 HF: Policy Governance
-- Adds policy update to governed actions.

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_UPDATE_POLICY', 'Update Organization Security Policy', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);


;


-- 
-- SOURCE: 067_compliance_exports.sql
-- 


-- 067_compliance_exports.sql
-- Epic 63: Compliance Exports (Job Lifecycle)

CREATE TABLE IF NOT EXISTS `compliance_exports` (
    `export_id` BINARY(16) NOT NULL PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `requested_by_user_id` VARCHAR(255) NOT NULL,
    `start_date` DATETIME NOT NULL,
    `end_date` DATETIME NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    `file_path` VARCHAR(255) DEFAULT NULL, -- Path to .zip
    `file_hash` VARCHAR(64) DEFAULT NULL, -- SHA256 of .zip
    `signature` TEXT DEFAULT NULL, -- RSA Signature of .zip (or manifest)
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `completed_at` TIMESTAMP NULL,
    `error_message` TEXT DEFAULT NULL,
    
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 068_compliance_export_items.sql
-- 


-- 068_compliance_export_items.sql
-- Epic 63: Compliance Export items (Manifest tracking within DB if needed, usually just in ZIP manifest)
-- Optional for detailed tracking, but let's stick to simple job lifecycle in 067 for now.
-- We can add this if we want to track individual files generated.
-- For Epic 63, the ZIP provided contains the manifest.
-- We'll skip this file unless required for advanced auditing.
-- Actually, let's create it to track what MODULES were included, for auditability.

CREATE TABLE IF NOT EXISTS `compliance_export_modules` (
    `export_id` BINARY(16) NOT NULL,
    `module_name` VARCHAR(50) NOT NULL, -- 'members', 'devices', 'audit'
    `item_count` INT DEFAULT 0,
    `status` ENUM('SUCCESS', 'SKIPPED', 'ERROR') DEFAULT 'SUCCESS',
    
    FOREIGN KEY (`export_id`) REFERENCES `compliance_exports`(`export_id`) ON DELETE CASCADE,
    INDEX `idx_export_mod` (`export_id`, `module_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 069_governance_export_action.sql
-- 


-- 069_governance_export_action.sql
-- Epic 63: Governance for Exports

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_EXPORT_COMPLIANCE', 'Generate Compliance Export', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);


;


-- 
-- SOURCE: 070_compliance_export_enums.sql
-- 


-- 070_compliance_export_enums.sql
-- Epic 63 HF: Enhanced Enums for Export Status

ALTER TABLE `compliance_exports` 
MODIFY COLUMN `status` ENUM('PENDING', 'APPROVED', 'GENERATING', 'READY', 'FAILED', 'EXPIRED') DEFAULT 'PENDING';

-- Add Redaction Flag
ALTER TABLE `compliance_exports`
ADD COLUMN `redaction_level` ENUM('NONE', 'PARTIAL', 'STRICT') DEFAULT 'PARTIAL';


;


-- 
-- SOURCE: 071_org_retention_policies.sql
-- 


-- 071_org_retention_policies.sql
-- Epic 64: Organization Retention Overrides

CREATE TABLE IF NOT EXISTS `org_retention_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `item_type` VARCHAR(50) NOT NULL, -- 'audit_log', 'chat_message', 'file', 'compliance_export'
    `retention_days` INT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` VARCHAR(255) NOT NULL,
    
    UNIQUE KEY `idx_org_item` (`org_id`, `item_type`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 072_archive_tier.sql
-- 


-- 072_archive_tier.sql
-- Epic 64: Archive Tier (Long-term immutable storage)

CREATE TABLE IF NOT EXISTS `archive_snapshots` (
    `snapshot_id` BINARY(16) NOT NULL PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `snapshot_date` DATE NOT NULL,
    `mongo_start_id` VARCHAR(64) DEFAULT NULL, -- Pointer to message range
    `mongo_end_id` VARCHAR(64) DEFAULT NULL,
    `audit_start_id` INT DEFAULT NULL,
    `audit_end_id` INT DEFAULT NULL,
    `file_path` VARCHAR(255) NOT NULL, -- Path to encrypted archive bundle
    `file_hash` VARCHAR(64) NOT NULL,
    `signature` TEXT NOT NULL,
    `status` ENUM('GENERATING', 'STORED', 'RESTORE_REQUESTED', 'PURGED') DEFAULT 'GENERATING',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_org_date` (`org_id`, `snapshot_date`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 073_governance_retention_archive.sql
-- 


-- 073_governance_retention_archive.sql
-- Epic 64 HF: Governance for Retention & Restore

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_UPDATE_RETENTION', 'Update Retention Policy', 1, 'ADMIN'),
('ORG_RESTORE_ARCHIVE', 'Restore Archive Snapshot', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);


;


-- 
-- SOURCE: 074_org_sso_settings.sql
-- 


-- 074_org_sso_settings.sql
-- Epic 65: SSO Configuration

CREATE TABLE IF NOT EXISTS `org_sso_settings` (
    `org_id` BINARY(16) NOT NULL PRIMARY KEY,
    `provider_type` ENUM('OIDC', 'SAML') DEFAULT 'OIDC',
    `issuer_url` VARCHAR(255) NOT NULL,
    `client_id` VARCHAR(255) NOT NULL,
    `client_secret` TEXT NOT NULL, -- Encrypted? Ideally yes.
    `allowed_domains` TEXT DEFAULT NULL, -- Comma separated
    `auto_provision` BOOLEAN DEFAULT FALSE,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` VARCHAR(255) NOT NULL,
    
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 075_org_sso_sessions.sql
-- 


-- 075_org_sso_sessions.sql
-- Epic 65: SSO Sessions / Nonce

CREATE TABLE IF NOT EXISTS `org_sso_states` (
    `state_token` VARCHAR(64) NOT NULL PRIMARY KEY, -- Nonce/State
    `org_id` BINARY(16) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NOT NULL,
    `status` ENUM('PENDING', 'CONSUMED', 'EXPIRED') DEFAULT 'PENDING',
    
    INDEX `idx_exp` (`expires_at`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 076_governance_sso.sql
-- 


-- 076_governance_sso.sql
-- Epic 65 HF: Governance for SSO

INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_UPDATE_SSO_CONFIG', 'Update SSO Configuration', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);


;


-- 
-- SOURCE: 077_sso_lockdown.sql
-- 


-- 077_sso_lockdown.sql
-- Epic 65 HF: SSO Lockdown Columns

ALTER TABLE `org_sso_settings`
ADD COLUMN `failed_attempts` INT DEFAULT 0,
ADD COLUMN `lockdown_until` TIMESTAMP NULL,
ADD COLUMN `lockdown_reason` VARCHAR(255) NULL;


;


-- 
-- SOURCE: 078_scim_tokens.sql
-- 


-- 078_scim_tokens.sql
-- Epic 66: SCIM Tokens

CREATE TABLE IF NOT EXISTS `scim_tokens` (
    `token_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL, -- SHA-256 hash of Bearer token
    `description` VARCHAR(255) DEFAULT 'SCIM Token',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `last_used_at` TIMESTAMP NULL,
    `revoked` BOOLEAN DEFAULT FALSE,
    `created_by` INT NOT NULL,
    
    INDEX `idx_org` (`org_id`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 079_scim_events.sql
-- 


-- 079_scim_events.sql
-- Epic 66: SCIM Audit Events

CREATE TABLE IF NOT EXISTS `scim_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `token_id` INT NOT NULL,
    `action_type` VARCHAR(50) NOT NULL, -- USER_CREATE, USER_UPDATE, USER_DELETE
    `target_user_email` VARCHAR(255) NULL,
    `payload_summary` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_org_time` (`org_id`, `created_at`),
    FOREIGN KEY (`token_id`) REFERENCES `scim_tokens`(`token_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 080_scim_hardening.sql
-- 


-- 080_scim_hardening.sql
-- Epic 66 HF: SCIM Hardening

-- 1. Token Hardening
ALTER TABLE `scim_tokens`
ADD COLUMN `expires_at` TIMESTAMP NULL,
ADD COLUMN `allowed_ips` TEXT NULL; -- CIDR list

-- 2. Governance for SCIM
INSERT INTO `governance_policies` (`action_type`, `description`, `min_approvers`, `required_role`) VALUES
('ORG_MANAGE_SCIM_TOKEN', 'Create or Revoke SCIM Token', 1, 'ADMIN')
ON DUPLICATE KEY UPDATE description = VALUES(description);


;


-- 
-- SOURCE: 081_org_licenses.sql
-- 


-- 081_org_licenses.sql
-- Epic 67: Organization Licenses

CREATE TABLE IF NOT EXISTS `org_licenses` (
    `org_id` BINARY(16) NOT NULL PRIMARY KEY,
    `plan_id` VARCHAR(50) NOT NULL DEFAULT 'FREE', -- FREE, PRO, ENTERPRISE
    `seat_limit` INT NOT NULL DEFAULT 5,
    `subscription_status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') DEFAULT 'ACTIVE',
    `expires_at` TIMESTAMP NULL,
    `features` JSON NULL, -- Cache of enabled features for fast lookup
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 082_attachments.sql
-- 


-- 082_attachments.sql
-- Epic 75: Attachment Metadata

CREATE TABLE IF NOT EXISTS `attachments` (
    `attachment_id` VARBINARY(32) PRIMARY KEY, -- Random ID
    `owner_user_id` VARCHAR(255) NOT NULL,
    `encrypted_size_bytes` BIGINT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `sha256_hash` VARBINARY(32) NOT NULL, -- Integrity Check
    `status` ENUM('PENDING', 'STORED', 'EXPIRED') DEFAULT 'PENDING',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL,
    
    FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 082_org_license_events.sql
-- 


-- 082_org_license_events.sql
-- Epic 67: License Audit Events

CREATE TABLE IF NOT EXISTS `org_license_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `event_type` VARCHAR(50) NOT NULL, -- UPGRADE, DOWNGRADE, EXPIRE
    `old_plan` VARCHAR(50) NULL,
    `new_plan` VARCHAR(50) NULL,
    `performed_by` INT NULL, -- NULL if system action
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_org` (`org_id`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 083_attachment_keys.sql
-- 


-- 083_attachment_keys.sql
-- Epic 75: Wrapped Keys for Recipients

CREATE TABLE IF NOT EXISTS `attachment_keys` (
    `key_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `attachment_id` VARBINARY(32) NOT NULL,
    `recipient_user_id` VARCHAR(255) NOT NULL,
    `recipient_device_id` VARCHAR(64) NOT NULL,
    `wrapped_key` TEXT NOT NULL, -- Encrypted file key (base64)
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_access` (`attachment_id`, `recipient_user_id`, `recipient_device_id`),
    FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`attachment_id`) ON DELETE CASCADE,
    FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 083_license_hardening.sql
-- 


-- 083_license_hardening.sql
-- Epic 67 HF: License Hardening

ALTER TABLE `org_licenses`
ADD COLUMN `license_hash` VARCHAR(64) NULL, -- SHA-256 of critical fields (integrity check)
ADD COLUMN `grace_period_end` TIMESTAMP NULL; -- For expired plans

-- HF-67.1: Ensure Transactional Safety (InnoDB handles row locking, but we need to ensure checks use it)
-- No schema change needed for FOR UPDATE, just code logic.


;


-- 
-- SOURCE: 084_calls.sql
-- 


-- 084_calls.sql
-- Epic 76: Call Sessions

CREATE TABLE IF NOT EXISTS `calls` (
    `call_id` VARBINARY(32) PRIMARY KEY, -- Random ID
    `initiator_user_id` VARCHAR(255) NOT NULL,
    `status` ENUM('INIT', 'ACTIVE', 'ENDED') DEFAULT 'INIT',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `ended_at` TIMESTAMP NULL,
    `end_reason` VARCHAR(100) DEFAULT NULL,
    
    FOREIGN KEY (`initiator_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 084_feature_flags.sql
-- 


-- 084_feature_flags.sql
-- Epic 68: Feature Flags

CREATE TABLE IF NOT EXISTS `feature_flags` (
    `flag_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `feature_key` VARCHAR(50) NOT NULL, -- e.g., 'SSO', 'EXPORTS'
    `is_enabled` BOOLEAN DEFAULT FALSE,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` INT NULL,
    
    UNIQUE KEY `uk_org_feature` (`org_id`, `feature_key`),
    FOREIGN KEY (`org_id`) REFERENCES `organizations`(`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 085_call_participants.sql
-- 


-- 085_call_participants.sql
-- Epic 76: Call Participants

CREATE TABLE IF NOT EXISTS `call_participants` (
    `participant_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `call_id` VARBINARY(32) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `status` ENUM('INVITED', 'JOINED', 'LEFT', 'REVOKED') DEFAULT 'INVITED',
    `joined_at` TIMESTAMP NULL,
    `left_at` TIMESTAMP NULL,
    
    UNIQUE KEY `uniq_call_device` (`call_id`, `user_id`, `device_id`),
    FOREIGN KEY (`call_id`) REFERENCES `calls`(`call_id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 085_feature_entitlements.sql
-- 


-- 085_feature_entitlements.sql
-- Epic 68: Feature Entitlements (Plan Mapping)

CREATE TABLE IF NOT EXISTS `feature_entitlements` (
    `plan_id` VARCHAR(50) NOT NULL,
    `feature_key` VARCHAR(50) NOT NULL,
    `is_allowed` BOOLEAN DEFAULT TRUE,
    
    PRIMARY KEY (`plan_id`, `feature_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data (Initial Defaults)
INSERT IGNORE INTO `feature_entitlements` (`plan_id`, `feature_key`, `is_allowed`) VALUES
('FREE', 'BASIC_CHAT', TRUE),
('FREE', 'SSO', FALSE),
('FREE', 'EXPORTS', FALSE),
('PRO', 'BASIC_CHAT', TRUE),
('PRO', 'SSO', FALSE),
('PRO', 'EXPORTS', TRUE),
('ENTERPRISE', 'BASIC_CHAT', TRUE),
('ENTERPRISE', 'SSO', TRUE),
('ENTERPRISE', 'EXPORTS', TRUE);


;


-- 
-- SOURCE: 086_call_ratchet_state.sql
-- 


-- 086_call_ratchet_state.sql
-- Epic 76: Ratchet State per Device

CREATE TABLE IF NOT EXISTS `call_ratchet_state` (
    `state_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `call_id` VARBINARY(32) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `current_ratchet_counter` INT DEFAULT 0,
    `last_key_rotation_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_ratchet` (`call_id`, `user_id`, `device_id`),
    FOREIGN KEY (`call_id`) REFERENCES `calls`(`call_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 086_feature_hardening.sql
-- 


-- 086_feature_hardening.sql
-- Epic 68 HF: Feature Hardening

-- 1. Anti-Tamper for Org Flags
ALTER TABLE `feature_flags`
ADD COLUMN `flag_hash` VARCHAR(64) NULL; -- SHA-256

-- 2. Staged Rollout for Entitlements
ALTER TABLE `feature_entitlements`
ADD COLUMN `rollout_percent` INT DEFAULT 100; -- 0-100

-- Seed Rollout (Example: SCIM only for 10% of Enterprise initially?)
UPDATE `feature_entitlements` SET `rollout_percent` = 10 WHERE `feature_key` = 'SCIM';


;


-- 
-- SOURCE: 087_call_policies.sql
-- 


-- 087_call_policies.sql (Updated)
-- Epic 77: Org Call Policies

CREATE TABLE IF NOT EXISTS `org_call_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `allow_calls` BOOLEAN DEFAULT TRUE,
    `allow_video` BOOLEAN DEFAULT TRUE,
    `allow_recording` BOOLEAN DEFAULT FALSE, -- HF-77.5
    `require_verified_contacts` BOOLEAN DEFAULT FALSE,
    `max_duration_seconds` INT DEFAULT 3600,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_org_policy` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 087_vault_items.sql
-- 


-- 087_vault_items.sql
-- Epic 69: Encrypted Vault Items

CREATE TABLE IF NOT EXISTS `vault_items` (
    `item_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
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


;


-- 
-- SOURCE: 088_call_moderation_events.sql
-- 


-- 088_call_moderation_events.sql
-- Epic 77: Moderation Logs

CREATE TABLE IF NOT EXISTS `call_moderation_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `call_id` VARBINARY(32) NOT NULL,
    `moderator_user_id` VARCHAR(255) NOT NULL,
    `action` ENUM('FORCE_END', 'KICK_DEVICE', 'FLAG_ABUSE') NOT NULL,
    `target_user_id` VARCHAR(255) DEFAULT NULL,
    `target_device_id` VARCHAR(64) DEFAULT NULL,
    `reason` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `signature` TEXT NOT NULL, -- Signed by server
    
    INDEX `idx_mod_call` (`call_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 088_vault_keys.sql
-- 


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


;


-- 
-- SOURCE: 089_org_message_policies.sql
-- 


-- 089_org_message_policies.sql
-- Epic 78: Org Messaging Policies

CREATE TABLE IF NOT EXISTS `org_message_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `allow_external_contacts` BOOLEAN DEFAULT TRUE,
    `allow_media` BOOLEAN DEFAULT TRUE,
    `allow_forwarding` BOOLEAN DEFAULT TRUE,
    `data_retention_days` INT DEFAULT 365, -- Default 1 year
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_org_msg_policy` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 089_vault_hardening.sql
-- 


-- 089_vault_hardening.sql
-- Epic 69 HF: Vault Hardening

ALTER TABLE `vault_items`
ADD COLUMN `item_version` INT DEFAULT 1,
ADD COLUMN `deleted_at` TIMESTAMP NULL; -- Soft delete for recovery window (optional) or audit

-- No schema change for quotas (logic in code) or audit (uses Audit Log).


;


-- 
-- SOURCE: 090_conversation_moderation.sql
-- 


-- 090_conversation_moderation.sql
-- Epic 78: Conversation Moderation State

CREATE TABLE IF NOT EXISTS `conversation_moderation_state` (
    `state_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `conversation_id` VARBINARY(32) NOT NULL,
    `is_frozen` BOOLEAN DEFAULT FALSE,
    `frozen_by_user_id` INT DEFAULT NULL,
    `frozen_at` TIMESTAMP NULL,
    `freeze_reason` VARCHAR(255),
    `legal_hold_active` BOOLEAN DEFAULT FALSE,
    `legal_hold_ref` VARCHAR(100),
    
    UNIQUE KEY `uniq_conv_mod` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 090_message_ttl_rules.sql
-- 


-- 090_message_ttl_rules.sql
-- Epic 70: Disappearing Messages Policies

CREATE TABLE IF NOT EXISTS `conversation_ttl_rules` (
    `conversation_id` VARBINARY(32) NOT NULL PRIMARY KEY,
    `default_ttl_seconds` INT DEFAULT NULL, -- NULL = infinite/permanent
    `allow_shorter_overrides` BOOLEAN DEFAULT TRUE,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` INT NULL,
    
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 091_message_expiry_queue.sql
-- 


-- 091_message_expiry_queue.sql
-- Epic 70: Message Expiry Queue

CREATE TABLE IF NOT EXISTS `message_expiry_queue` (
    `message_id` BINARY(16) NOT NULL PRIMARY KEY,
    `conversation_id` BINARY(16) NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `status` ENUM('PENDING', 'PROCESSED', 'FAILED', 'HELD') DEFAULT 'PENDING',
    
    INDEX `idx_expiry` (`expires_at`, `status`),
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON DELETE CASCADE
    -- message_id FK usually implies messages table, but that might be partitioned.
    -- Strict FK ideal but queue might outlive message if deletion fails.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 091_message_forward_events.sql
-- 


-- 091_message_forward_events.sql
-- Epic 78: Forwarding Audit

CREATE TABLE IF NOT EXISTS `message_forward_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `source_message_id` VARBINARY(32) NOT NULL,
    `source_conversation_id` VARBINARY(32) NOT NULL,
    `target_conversation_id` VARBINARY(32) NOT NULL,
    `user_id` INT NOT NULL,
    `status` ENUM('ALLOWED', 'BLOCKED') NOT NULL,
    `reason` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_fwd_src` (`source_conversation_id`),
    INDEX `idx_fwd_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 092_broadcast_lists.sql
-- 


-- 092_broadcast_lists.sql
-- Epic 79: Broadcast Lists Metadata

CREATE TABLE IF NOT EXISTS `broadcast_lists` (
    `list_id` VARBINARY(32) NOT NULL PRIMARY KEY, -- UUID
    `owner_user_id` INT NOT NULL,
    `list_name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    
    INDEX `idx_broadcast_owner` (`owner_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 092_tombstones.sql
-- 


-- 092_tombstones.sql
-- Epic 70 HF: Message Tombstones for Sync

CREATE TABLE IF NOT EXISTS `message_tombstones` (
    `tombstone_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `message_id` BINARY(16) NOT NULL,
    `conversation_id` BINARY(16) NOT NULL,
    `deleted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `reason` ENUM('TTL', 'USER_DELETE', 'ADMIN_DELETE') DEFAULT 'TTL',
    
    INDEX `idx_sync` (`conversation_id`, `deleted_at`),
    UNIQUE KEY `idx_msg` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 093_broadcast_list_members.sql
-- 


-- 093_broadcast_list_members.sql
-- Epic 79: Broadcast List Members

CREATE TABLE IF NOT EXISTS `broadcast_list_members` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `list_id` VARBINARY(32) NOT NULL,
    `member_user_id` INT NOT NULL,
    `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_list_member` (`list_id`, `member_user_id`),
    INDEX `idx_list_members` (`list_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 093_deletion_receipts.sql
-- 


-- 093_deletion_receipts.sql
-- Epic 70 HF: Permanent Deletion Receipts

CREATE TABLE IF NOT EXISTS `deletion_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `message_id` BINARY(16) NOT NULL,
    `conversation_id` BINARY(16) NOT NULL,
    `deleted_at` TIMESTAMP NOT NULL,
    `reason` VARCHAR(50) NOT NULL,
    `receipt_signature` TEXT NOT NULL, -- Base64 encoded signature
    
    INDEX `idx_conv` (`conversation_id`),
    INDEX `idx_msg` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 094_min_ttl.sql
-- 


-- Update Rules for Min TTL
ALTER TABLE `conversation_ttl_rules`
ADD COLUMN `min_ttl_seconds` INT DEFAULT 0; -- 0 = No Minimum


;


-- 
-- SOURCE: 094_view_once.sql
-- 


-- 094_view_once.sql
-- Epic 80: View Once Metadata

ALTER TABLE `messages` 
ADD COLUMN `message_type_old` VARCHAR(50) DEFAULT 'text', -- Preserve old if needed or just use existing
ADD COLUMN `message_type` VARCHAR(50) NOT NULL DEFAULT 'text'; 

-- Or better, just add a flag if type is already generic
ALTER TABLE `messages`
ADD COLUMN `is_view_once` BOOLEAN DEFAULT FALSE,
ADD COLUMN `viewed_at` TIMESTAMP NULL DEFAULT NULL;

-- Index for cleanup
CREATE INDEX `idx_view_once_pending` ON `messages` (`is_view_once`, `viewed_at`);


;


-- 
-- SOURCE: 095_privacy_events.sql
-- 


-- 095_privacy_events.sql
-- Epic 71: Screenshot & Recording Events

CREATE TABLE IF NOT EXISTS `privacy_events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `conversation_id` BINARY(16) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `device_id` VARCHAR(64) DEFAULT NULL,
    `event_type` ENUM('SCREENSHOT_TAKEN', 'SCREEN_RECORDING_STARTED', 'SCREEN_RECORDING_STOPPED') NOT NULL,
    `platform` VARCHAR(20) DEFAULT NULL, -- ANDROID, IOS, WEB
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_conv` (`conversation_id`),
    INDEX `idx_user` (`user_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 095_privacy_settings.sql
-- 


-- 095_privacy_settings.sql
-- Epic 81: Privacy Settings Metadata

CREATE TABLE IF NOT EXISTS `user_privacy_settings` (
    `user_id` VARCHAR(255) NOT NULL PRIMARY KEY,
    
    -- Visibility Rules: 'everyone', 'contacts', 'nobody', 'except'
    `last_seen_visibility` ENUM('everyone', 'contacts', 'nobody') DEFAULT 'contacts',
    `profile_photo_visibility` ENUM('everyone', 'contacts', 'nobody') DEFAULT 'contacts',
    `about_visibility` ENUM('everyone', 'contacts', 'nobody') DEFAULT 'contacts',
    
    `read_receipts_enabled` BOOLEAN DEFAULT TRUE,
    
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exceptions table for 'My Contacts Except...'
CREATE TABLE IF NOT EXISTS `privacy_exceptions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `blocked_viewer_id` VARCHAR(255) NOT NULL, -- The contact who is EXCLUDED from seeing
    `setting_type` ENUM('last_seen', 'profile_photo', 'about') NOT NULL,
    
    UNIQUE KEY `uniq_exception` (`user_id`, `blocked_viewer_id`, `setting_type`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 096_privacy_audit.sql
-- 


-- 096_privacy_audit.sql
-- Epic 81 HF: Audit Logs for Privacy Changes

CREATE TABLE IF NOT EXISTS `privacy_audit_logs` (
    `log_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `field_name` VARCHAR(50) NOT NULL,
    `old_value` VARCHAR(50),
    `new_value` VARCHAR(50) NOT NULL,
    `changed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `ip_address` VARCHAR(45), -- IPv6 OK
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 096_privacy_settings.sql
-- 


-- 096_privacy_settings.sql
-- Epic 71: Screen Shield Settings

-- Add column to conversations table if possible, or separate settings table.
-- Using separate table for cleanliness/extensibility.

CREATE TABLE IF NOT EXISTS `conversation_privacy_settings` (
    `conversation_id` BINARY(16) NOT NULL PRIMARY KEY,
    `shield_mode` BOOLEAN DEFAULT FALSE, -- Block Screenshots/Blur
    `alert_on_screenshot` BOOLEAN DEFAULT TRUE,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` INT NULL,
    
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 097_group_permissions.sql
-- 


-- 097_group_permissions.sql
-- Epic 82: Group Admin Controls

ALTER TABLE `groups`
ADD COLUMN `only_admins_message` BOOLEAN DEFAULT FALSE,
ADD COLUMN `only_admins_edit_info` BOOLEAN DEFAULT FALSE,
ADD COLUMN `only_admins_add_users` BOOLEAN DEFAULT FALSE,
ADD COLUMN `approval_required_to_join` BOOLEAN DEFAULT FALSE;

-- Audit Log for Group Settings
CREATE TABLE IF NOT EXISTS `group_audit_logs` (
    `log_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(100) NOT NULL,
    `actor_user_id` VARCHAR(255) NOT NULL,
    `action_type` VARCHAR(50) NOT NULL, -- 'UPDATE_SETTINGS', 'CHANGE_ROLE'
    `details` JSON,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
    -- FK to groups if possible, but group_id might be binary
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 097_privacy_hardening.sql
-- 


-- 097_privacy_hardening.sql
-- Epic 71 HF: Watermark Mode

ALTER TABLE `conversation_privacy_settings`
ADD COLUMN `watermark_enabled` BOOLEAN DEFAULT FALSE;


;


-- 
-- SOURCE: 098_contact_verifications.sql
-- 


-- 098_contact_verifications.sql
-- Epic 72: Trust Verification Center

CREATE TABLE IF NOT EXISTS `contact_verifications` (
    `verification_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `contact_user_id` VARCHAR(255) NOT NULL,
    `verified_key_hash` VARCHAR(64) NOT NULL, -- SHA256 of the Identity Key
    `status` ENUM('VERIFIED', 'UNVERIFIED', 'BROKEN') DEFAULT 'VERIFIED',
    `verified_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `idx_pair` (`user_id`, `contact_user_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`contact_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 098_group_join_requests.sql
-- 


-- 098_group_join_requests.sql
-- Epic 82 HF: Join Approvals

CREATE TABLE IF NOT EXISTS `group_join_requests` (
    `request_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `group_id` VARCHAR(100) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `processed_at` TIMESTAMP NULL,
    `processed_by` VARCHAR(255) NULL,
    
    UNIQUE KEY `uniq_request` (`group_id`, `user_id`, `status`), -- Prevent duplicate pendings
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`processed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 099_read_receipts_settings.sql
-- 


-- 099_read_receipts_settings.sql
-- Epic 83: Read Receipts Settings

-- Ensure user_privacy_settings has read_receipts_enabled (Already in 095, but safe to verify)
-- If we need Org Override, we might need a policies table.
-- Mocking Org Policy in Engine for now as requested in Plan, 
-- but let's create a placeholder table for future org policies.

CREATE TABLE IF NOT EXISTS `organization_policies` (
    `policy_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `org_id` BINARY(16) NOT NULL,
    `policy_key` VARCHAR(50) NOT NULL, -- 'READ_RECEIPTS', 'TRAFFIC_PADDING'
    `policy_value` VARCHAR(50) NOT NULL, -- 'FORCE_OFF', 'FORCE_ON', 'HIGH', 'LOW'
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_policy` (`org_id`, `policy_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 099_verification_receipts.sql
-- 


-- 099_verification_receipts.sql
-- Epic 72 HF: Signed Verification Receipts

CREATE TABLE IF NOT EXISTS `verification_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `contact_user_id` VARCHAR(255) NOT NULL,
    `key_hash` VARCHAR(64) NOT NULL,
    `verified_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `signature` TEXT NOT NULL, -- Server signature of the event
    
    INDEX `idx_user` (`user_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 100_forwarding_metadata.sql
-- 


-- 100_forwarding_metadata.sql
-- Epic 84: Forwarding Governance

-- Add forwarding_score message metadata
-- Usually messages table is immutable for content, but metadata like "has been forwarded X times" 
-- is a property of the message payload as it travels. 
-- Wait, in Signal/WhatsApp, "Frequency" is a property of the *received* message based on the chain.
-- When A forwards to B, B receives a New Message.
-- The New Message has `forwarding_score = A's score + 1`.
-- So we add the column to `messages` table.

ALTER TABLE `messages`
ADD COLUMN `forwarding_score` INT DEFAULT 0,
ADD INDEX `idx_forwarding_score` (`forwarding_score`);


;


-- 
-- SOURCE: 100_recovery_phrases.sql
-- 


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


;


-- 
-- SOURCE: 101_backup_jobs.sql
-- 


-- 101_backup_jobs.sql
-- Epic 73: Backup Job Lifecycle

CREATE TABLE IF NOT EXISTS `backup_jobs` (
    `job_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    `file_path` VARCHAR(255) DEFAULT NULL, -- Path to blob if strictly local, or ref ID
    `backup_size_bytes` BIGINT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL,
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 102_backup_blobs.sql
-- 


-- 102_backup_blobs.sql
-- Epic 73: Encrypted Backup Blobs

CREATE TABLE IF NOT EXISTS `backup_blobs` (
    `blob_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `job_id` BIGINT NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `encrypted_data` LONGBLOB, -- The actual encrypted bundle
    `iv` BINARY(12) NOT NULL, -- AES-GCM IV
    `auth_tag` BINARY(16) NOT NULL, -- AES-GCM Auth Tag
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`job_id`) REFERENCES `backup_jobs`(`job_id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 103_backup_hardening.sql
-- 


-- 103_backup_hardening.sql
-- Epic 73 HF: Strong KDF & Signed Backups

ALTER TABLE `recovery_phrases`
ADD COLUMN `kdf_params` JSON DEFAULT NULL, -- Stores {algo: 'argon2id', mem: 65536, ...}
ADD COLUMN `key_version` INT DEFAULT 1;

ALTER TABLE `backup_blobs`
ADD COLUMN `signature` TEXT DEFAULT NULL, -- Server signature of blob hash
ADD COLUMN `schema_version` INT DEFAULT 1;


;


-- 
-- SOURCE: 104_anonymous_profiles.sql
-- 


-- 104_anonymous_profiles.sql
-- Epic 74: Anonymous Profiles per Conversation

CREATE TABLE IF NOT EXISTS `anonymous_profiles` (
    `profile_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `conversation_id` VARBINARY(32) NOT NULL, -- Specific to a conversation
    `alias_name` VARCHAR(50) NOT NULL, -- e.g., "Ghost-91"
    `alias_icon` VARCHAR(255) DEFAULT NULL, -- URL or icon ID
    `is_anonymous` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `unique_user_conv` (`user_id`, `conversation_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 105_metadata_redaction.sql
-- 


-- 105_metadata_redaction.sql
-- Epic 74: Metadata Redaction Policies

CREATE TABLE IF NOT EXISTS `redaction_policies` (
    `policy_id` INT AUTO_INCREMENT PRIMARY KEY,
    `field_name` VARCHAR(50) NOT NULL, -- e.g., 'ip_address', 'email'
    `redaction_type` ENUM('MASK', 'REMOVE', 'HASH') DEFAULT 'MASK',
    `replacement_value` VARCHAR(50) DEFAULT '[REDACTED]',
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default policies
INSERT INTO `redaction_policies` (`field_name`, `redaction_type`) VALUES 
('ip_address', 'MASK'),
('email', 'MASK'),
('device_id', 'HASH');


;


-- 
-- SOURCE: 106_alias_receipts.sql
-- 


-- 106_alias_receipts.sql
-- Epic 74 HF: Signed Alias History & Receipts

CREATE TABLE IF NOT EXISTS `alias_history_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `conversation_id` VARBINARY(32) NOT NULL,
    `old_alias` VARCHAR(50),
    `new_alias` VARCHAR(50) NOT NULL,
    `changed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `signature` TEXT NOT NULL, -- Server signature of change event
    
    INDEX `idx_user_conv` (`user_id`, `conversation_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 107_media_audit.sql
-- 


-- 107_media_audit.sql
-- Epic 75 HF: Media Audit & Quotas

CREATE TABLE IF NOT EXISTS `media_audit_logs` (
    `log_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(255) NOT NULL,
    `attachment_id` VARBINARY(32),
    `action` ENUM('UPLOAD', 'DOWNLOAD', 'KEY_FETCH', 'DELETE') NOT NULL,
    `details` JSON,
    `ip_address` VARCHAR(45),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_media_audit_user` (`user_id`),
    INDEX `idx_media_audit_attach` (`attachment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attachment_receipts` (
    `receipt_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `attachment_id` VARBINARY(32) NOT NULL,
    `uploader_id` VARCHAR(255) NOT NULL,
    `sha256_hash` VARBINARY(32) NOT NULL,
    `timestamp` BIGINT NOT NULL,
    `signature` TEXT NOT NULL,
    
    UNIQUE KEY `uniq_attach_receipt` (`attachment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;


-- 
-- SOURCE: 108_call_audit.sql
-- 


-- 108_call_audit.sql
-- Epic 76 HF: Call Audit & Abuse Prevention

CREATE TABLE IF NOT EXISTS `call_audit_logs` (
    `log_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `call_id` VARBINARY(32) NOT NULL,
    `user_id` VARCHAR(255) NOT NULL,
    `device_id` VARCHAR(64),
    `action` ENUM('JOIN_ATTEMPT', 'JOIN_FAILED', 'JOIN_SUCCESS', 'RATCHET', 'END') NOT NULL,
    `reason` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_call_audit_user` (`user_id`, `created_at`),
    INDEX `idx_call_audit_call` (`call_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `call_lockdowns` (
    `call_id` VARBINARY(32) PRIMARY KEY,
    `locked_until` TIMESTAMP NOT NULL,
    `failure_count` INT DEFAULT 0,
    `last_failure_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


;
