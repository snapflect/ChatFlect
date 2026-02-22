-- Migration: 114_audit_hardening.sql
-- Epic 54: High-Integrity Auditing
-- Purpose: Optimize audit logs for user history and add importance levels.

ALTER TABLE audit_logs 
    ADD COLUMN severity ENUM('INFO', 'WARN', 'CRITICAL') DEFAULT 'INFO' AFTER action,
    ADD COLUMN category VARCHAR(50) DEFAULT 'GENERAL' AFTER severity,
    ADD INDEX idx_user_history (user_id, created_at DESC),
    ADD INDEX idx_severity (severity);

-- Retroactive categorization for critical events
UPDATE audit_logs SET severity = 'CRITICAL' WHERE action IN ('auth_failed', 'token_reuse_detected', 'account_delete', 'device_revoked');
UPDATE audit_logs SET severity = 'WARN' WHERE action IN ('login_failed', 'otp_failed', 'rate_limit_hit');
