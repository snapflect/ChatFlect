-- 058_admin_action_queue.sql
-- Epic 58: Admin Action Queue
-- Stores pending actions waiting for approval.

CREATE TABLE IF NOT EXISTS `admin_action_queue` (
    `request_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `action_type` VARCHAR(50) NOT NULL,
    `target_resource` VARCHAR(255) NOT NULL, -- JSON or ID (e.g., {"user_id": 123})
    `requester_id` INT NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'EXPIRED') DEFAULT 'PENDING',
    `approval_metadata` JSON DEFAULT NULL, -- Stores approver IDs and timestamps
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL,
    
    FOREIGN KEY (`action_type`) REFERENCES `governance_policies`(`action_type`),
    INDEX `idx_status` (`status`),
    INDEX `idx_requester` (`requester_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
