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
