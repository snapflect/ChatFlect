-- Migration: 050_receipt_deduplication
-- HF-Extra: Enforce Receipt Uniqueness
-- Date: 2026-02-16

-- Add unique constraint to message_receipts if it exists
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'message_receipts' AND TABLE_SCHEMA = DATABASE()) > 0,
    'ALTER TABLE message_receipts ADD UNIQUE INDEX IF NOT EXISTS uk_receipt_dedupe (message_uuid, user_id, status)',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Also check 'receipts' table (from 015_receipts.sql)
SET @s2 = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'receipts' AND TABLE_SCHEMA = DATABASE()) > 0,
    'ALTER TABLE receipts ADD UNIQUE INDEX IF NOT EXISTS uk_receipt_dedupe (message_uuid, user_id, type)',
    'SELECT 1'
));
PREPARE stmt2 FROM @s2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
