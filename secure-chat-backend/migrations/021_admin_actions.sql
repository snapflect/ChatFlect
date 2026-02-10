-- Migration: 021_admin_actions.sql
-- Epic 27: Admin Moderation Dashboard
-- Purpose: Track all admin interventions for audit trail.

CREATE TABLE IF NOT EXISTS admin_actions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_id VARCHAR(255) NOT NULL,
    target_user_id VARCHAR(255) NOT NULL,
    action_type ENUM('LOCK_USER', 'UNLOCK_USER', 'RESET_ABUSE_SCORE', 'REVOKE_ALL_DEVICES', 'VIEW_USER') NOT NULL,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_target_user (target_user_id, created_at),
    INDEX idx_admin_id (admin_id, created_at),
    INDEX idx_action_type (action_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
