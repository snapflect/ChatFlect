-- 097_privacy_hardening.sql
-- Epic 71 HF: Watermark Mode

ALTER TABLE `conversation_privacy_settings`
ADD COLUMN `watermark_enabled` BOOLEAN DEFAULT FALSE;
