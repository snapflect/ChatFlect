-- HF-5B.2: Sender Key Versioning & Replay Protection

ALTER TABLE group_sender_key_state 
ADD COLUMN bundle_version INT DEFAULT 0 AFTER sender_key_id;

ALTER TABLE group_sender_keys 
ADD COLUMN bundle_version INT DEFAULT 0 AFTER sender_key_id;

-- Ensure indexes for performance
-- (Assuming existing indexes on group_id, sender_id)
