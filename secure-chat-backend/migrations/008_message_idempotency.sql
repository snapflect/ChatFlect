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
