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
