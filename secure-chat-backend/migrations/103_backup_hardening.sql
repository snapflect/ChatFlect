-- 103_backup_hardening.sql
-- Epic 73 HF: Strong KDF & Signed Backups

ALTER TABLE `recovery_phrases`
ADD COLUMN `kdf_params` JSON DEFAULT NULL, -- Stores {algo: 'argon2id', mem: 65536, ...}
ADD COLUMN `key_version` INT DEFAULT 1;

ALTER TABLE `backup_blobs`
ADD COLUMN `signature` TEXT DEFAULT NULL, -- Server signature of blob hash
ADD COLUMN `schema_version` INT DEFAULT 1;
