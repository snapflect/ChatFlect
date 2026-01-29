-- Migration V5: Architectural Caching & Session Management
-- Enhances performance by offloading JWT validation to cache and tracking tokens

-- Table: cache_store
-- Used to store serialized API results and expensive query data
CREATE TABLE IF NOT EXISTS cache_store (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value MEDIUMTEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: user_sessions
-- Used to track JWT active status, refresh tokens, and multi-device compliance
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    device_uuid VARCHAR(64) NOT NULL,
    id_token_jti VARCHAR(64) NOT NULL,
    refresh_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_session (user_id, device_uuid),
    INDEX idx_jti (id_token_jti),
    INDEX idx_refresh (refresh_token),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add JTI index to users if not present (optional, but good for lookup)
-- ALTER TABLE users ADD INDEX idx_email (email);
