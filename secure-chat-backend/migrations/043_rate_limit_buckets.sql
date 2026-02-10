-- 043_rate_limit_buckets.sql
-- Epic 52: Token Bucket Store for Global Rate Limiter
-- Stores current token count and last update time for each bucket.

CREATE TABLE IF NOT EXISTS `rate_limit_buckets` (
    `bucket_key` VARCHAR(128) PRIMARY KEY, -- Hash(IP + User + Action)
    `tokens` FLOAT NOT NULL,
    `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL, -- For auto-cleanup
    
    INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
