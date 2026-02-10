-- 055_vuln_attachments.sql
-- Epic 57: Vulnerability Attachments
-- Stores metadata for uploaded PoCs.

CREATE TABLE IF NOT EXISTS `vulnerability_attachments` (
    `attachment_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `report_id` BIGINT NOT NULL,
    `filename_original` VARCHAR(255) NOT NULL,
    `filename_storage` VARCHAR(255) NOT NULL, -- Random hash
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size` INT NOT NULL,
    `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (`report_id`) REFERENCES `vulnerability_reports`(`report_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
