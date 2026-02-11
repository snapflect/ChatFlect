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
