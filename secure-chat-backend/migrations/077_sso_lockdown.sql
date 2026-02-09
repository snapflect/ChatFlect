-- 077_sso_lockdown.sql
-- Epic 65 HF: SSO Lockdown Columns

ALTER TABLE `org_sso_settings`
ADD COLUMN `failed_attempts` INT DEFAULT 0,
ADD COLUMN `lockdown_until` TIMESTAMP NULL,
ADD COLUMN `lockdown_reason` VARCHAR(255) NULL;
