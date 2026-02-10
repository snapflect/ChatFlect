-- Update Rules for Min TTL
ALTER TABLE `conversation_ttl_rules`
ADD COLUMN `min_ttl_seconds` INT DEFAULT 0; -- 0 = No Minimum
