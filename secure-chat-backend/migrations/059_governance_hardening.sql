-- 059_governance_hardening.sql
-- Epic 58 HF: Governance Hardening
-- Adds hashing, identity management, and rejection logging.

-- 1. Admin Identity Table
CREATE TABLE IF NOT EXISTS `admin_identities` (
    `admin_id` INT PRIMARY KEY, -- Maps to main user/admin table
    `role` ENUM('SECURITY', 'OPS', 'SUPER_ADMIN') NOT NULL DEFAULT 'OPS',
    `status` ENUM('ACTIVE', 'REVOKED') DEFAULT 'ACTIVE',
    `public_key` TEXT DEFAULT NULL, -- For future signed actions
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Hardening Action Queue
ALTER TABLE `admin_action_queue`
ADD COLUMN `action_hash` CHAR(64) DEFAULT NULL AFTER `target_resource`,
ADD COLUMN `rejection_reason` TEXT DEFAULT NULL AFTER `status`;

-- 3. Policy Constraints
ALTER TABLE `governance_policies`
ADD COLUMN `is_locked` BOOLEAN DEFAULT FALSE; -- If true, policy itself cannot be changed easily

-- Backfill hashes for existing rows (if any)
UPDATE `admin_action_queue` 
SET `action_hash` = SHA2(CONCAT(action_type, target_resource, created_at), 256) 
WHERE `action_hash` IS NULL;
