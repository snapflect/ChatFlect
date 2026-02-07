-- 003_signed_prekey_rotations.sql
-- Epic 3, Story 3.3: Rotation History & Audit Logging

CREATE TABLE IF NOT EXISTS signed_prekey_rotations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    device_id INT NOT NULL,
    old_key_version INT NOT NULL,
    new_key_version INT NOT NULL,
    signed_prekey_id INT NOT NULL,
    rotated_at DATETIME NOT NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    event_type VARCHAR(50) NOT NULL DEFAULT 'ROTATE_SUCCESS',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_device (user_id, device_id),
    INDEX idx_rotated_at (rotated_at)
);
