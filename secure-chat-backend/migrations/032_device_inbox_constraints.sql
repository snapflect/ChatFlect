-- 032_device_inbox_constraints.sql
-- Epic 48-HF: Hardening - Inbox Constraints

-- 1. Prevent duplicate messages in device inbox (Replay Protection)
ALTER TABLE `device_inbox`
ADD CONSTRAINT `uq_device_message` UNIQUE (`recipient_device_id`, `message_uuid`);

-- 2. Prevent duplicate sessions per device pair
ALTER TABLE `device_sessions`
ADD CONSTRAINT `uq_device_pair` UNIQUE (`sender_device_id`, `recipient_device_id`);
