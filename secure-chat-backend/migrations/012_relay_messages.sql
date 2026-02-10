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
