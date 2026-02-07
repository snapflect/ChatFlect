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
CREATE INDEX idx_messages_chat_seq ON messages (chat_id, server_seq);
