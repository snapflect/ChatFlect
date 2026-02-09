-- 083_license_hardening.sql
-- Epic 67 HF: License Hardening

ALTER TABLE `org_licenses`
ADD COLUMN `license_hash` VARCHAR(64) NULL, -- SHA-256 of critical fields (integrity check)
ADD COLUMN `grace_period_end` TIMESTAMP NULL; -- For expired plans

-- HF-67.1: Ensure Transactional Safety (InnoDB handles row locking, but we need to ensure checks use it)
-- No schema change needed for FOR UPDATE, just code logic.
