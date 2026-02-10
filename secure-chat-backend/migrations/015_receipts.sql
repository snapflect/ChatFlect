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
