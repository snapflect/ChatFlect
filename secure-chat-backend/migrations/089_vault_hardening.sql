-- 089_vault_hardening.sql
-- Epic 69 HF: Vault Hardening

ALTER TABLE `vault_items`
ADD COLUMN `item_version` INT DEFAULT 1,
ADD COLUMN `deleted_at` TIMESTAMP NULL; -- Soft delete for recovery window (optional) or audit

-- No schema change for quotas (logic in code) or audit (uses Audit Log).
