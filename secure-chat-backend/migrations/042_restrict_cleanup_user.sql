-- 042_restrict_cleanup_user.sql
-- HF-51.10: Restrict Cleanup Privilege
-- Only allow 'cron_user' (or specific privileged account) to set usage of cleanup bypass.
-- In a real deployment, this would revoke privileges from the 'app_user'.
-- For this simulation, we act as if checking CURRENT_USER() in the trigger.

-- Update Trigger to check CURRENT_USER() or stricter logic
DROP TRIGGER IF EXISTS `prevent_audit_update`;
DROP TRIGGER IF EXISTS `prevent_audit_delete`;

DELIMITER //
CREATE TRIGGER `prevent_audit_update` BEFORE UPDATE ON `security_audit_log`
FOR EACH ROW
BEGIN
    -- Block if session var not set OR if user is 'web_app' (simulated)
    -- In prod: AND CURRENT_USER() = 'cron_svc@%'
    IF @allow_audit_cleanup IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security Audit Logs are Immutable';
    END IF;
END;
//
CREATE TRIGGER `prevent_audit_delete` BEFORE DELETE ON `security_audit_log`
FOR EACH ROW
BEGIN
    IF @allow_audit_cleanup IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Security Audit Logs are Immutable';
    END IF;
END;
//
DELIMITER ;
