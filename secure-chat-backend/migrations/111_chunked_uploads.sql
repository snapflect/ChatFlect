-- Migration 111: Chunked Media Upload Sessions
-- Supports Phase 5E: Chunked Uploads + Resume + Retry

CREATE TABLE IF NOT EXISTS upload_sessions (
    upload_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    filename TEXT NOT NULL,
    total_size BIGINT NOT NULL,
    chunk_count INT NOT NULL,
    last_chunk_index INT DEFAULT -1,
    sha256_hash VARCHAR(64) DEFAULT NULL,
    status ENUM('active', 'finalizing', 'completed', 'expired') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_upload_user (user_id),
    INDEX idx_upload_status (status),
    INDEX idx_upload_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
