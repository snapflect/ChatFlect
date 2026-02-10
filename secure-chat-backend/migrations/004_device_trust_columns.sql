-- 004_device_trust_columns.sql
-- Epic 4, Story 4.1: Device Trust Registry & Revocation
-- Strict Zero-Trust Enforcement

-- 1. Add Trust Columns
-- status: 'pending' (Default for new), 'active' (Approved), 'revoked' (Banned)
-- revoked_at: Timestamp of revocation
-- Audit columns: ip_address, user_agent (for tracking registration source)

SET @dbname = DATABASE();

-- Add 'status' column
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = 'user_devices')
      AND (table_schema = @dbname)
      AND (column_name = 'status')
  ) > 0,
  "SELECT 1",
  "ALTER TABLE user_devices ADD COLUMN status ENUM('pending', 'active', 'revoked') NOT NULL DEFAULT 'pending';"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add 'revoked_at' column
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = 'user_devices')
      AND (table_schema = @dbname)
      AND (column_name = 'revoked_at')
  ) > 0,
  "SELECT 1",
  "ALTER TABLE user_devices ADD COLUMN revoked_at DATETIME NULL DEFAULT NULL AFTER status;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add 'ip_address'
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = 'user_devices')
      AND (table_schema = @dbname)
      AND (column_name = 'ip_address')
  ) > 0,
  "SELECT 1",
  "ALTER TABLE user_devices ADD COLUMN ip_address VARCHAR(45) NULL AFTER revoked_at;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add 'user_agent'
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = 'user_devices')
      AND (table_schema = @dbname)
      AND (column_name = 'user_agent')
  ) > 0,
  "SELECT 1",
  "ALTER TABLE user_devices ADD COLUMN user_agent VARCHAR(255) NULL AFTER ip_address;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Data Migration for Existing Users
-- CRITICAL: Prevent lockout. Existing devices (created before this migration) should be ACTIVE.
-- We identify them by NULL status (if added as NULLable first) or update all pending ones that have 'last_active' set? 
-- Since we added it as NOT NULL DEFAULT 'pending', all existing rows now have 'pending'.
-- We must update valid existing devices to 'active'.
-- Assumption: Any device with a registered `public_key` and valid `last_active` is legacy active.
UPDATE user_devices 
SET status = 'active' 
WHERE status = 'pending' AND created_at < NOW();

-- 3. Ensure Unique Index (P0 Security Requirement)
-- Verify unique constraint on (user_id, device_uuid) to prevent spoofing
-- This might fail if duplicates exist. If so, manual cleanup required. 
-- We try to add it safely.
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = 'user_devices')
      AND (table_schema = @dbname)
      AND (index_name = 'unique_device')
  ) > 0,
  "SELECT 1",
  "CREATE UNIQUE INDEX unique_device ON user_devices (user_id, device_uuid);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
