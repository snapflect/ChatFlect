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
