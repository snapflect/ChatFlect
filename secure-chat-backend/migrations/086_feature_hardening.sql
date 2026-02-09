-- 086_feature_hardening.sql
-- Epic 68 HF: Feature Hardening

-- 1. Anti-Tamper for Org Flags
ALTER TABLE `feature_flags`
ADD COLUMN `flag_hash` VARCHAR(64) NULL; -- SHA-256

-- 2. Staged Rollout for Entitlements
ALTER TABLE `feature_entitlements`
ADD COLUMN `rollout_percent` INT DEFAULT 100; -- 0-100

-- Seed Rollout (Example: SCIM only for 10% of Enterprise initially?)
UPDATE `feature_entitlements` SET `rollout_percent` = 10 WHERE `feature_key` = 'SCIM';
