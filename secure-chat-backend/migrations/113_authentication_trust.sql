-- Migration: 113_authentication_trust.sql
-- Epic 53: Authentication Hardening
-- Purpose: Support Refresh Token Rotation with Reuse Detection and Session Revocation.

-- 1. Standardize and Harden user_sessions
ALTER TABLE user_sessions 
    ADD COLUMN rotation_family VARCHAR(64) NULL AFTER device_uuid,
    ADD COLUMN last_refresh_token_hash VARCHAR(128) NULL AFTER refresh_token,
    ADD COLUMN is_revoked TINYINT(1) DEFAULT 0 AFTER expires_at,
    ADD COLUMN revoked_at TIMESTAMP NULL DEFAULT NULL AFTER is_revoked,
    ADD INDEX idx_rotation_family (rotation_family),
    ADD INDEX idx_revoked (is_revoked);

-- 2. Retroactively assign rotation families to existing sessions
UPDATE user_sessions SET rotation_family = MD5(CONCAT(user_id, device_uuid)) WHERE rotation_family IS NULL;

-- 3. Add unique constraint on jti for faster lookups
ALTER TABLE user_sessions ADD UNIQUE INDEX idx_jti (id_token_jti);
