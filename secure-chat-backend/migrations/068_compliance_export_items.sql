-- 068_compliance_export_items.sql
-- Epic 63: Compliance Export items (Manifest tracking within DB if needed, usually just in ZIP manifest)
-- Optional for detailed tracking, but let's stick to simple job lifecycle in 067 for now.
-- We can add this if we want to track individual files generated.
-- For Epic 63, the ZIP provided contains the manifest.
-- We'll skip this file unless required for advanced auditing.
-- Actually, let's create it to track what MODULES were included, for auditability.

CREATE TABLE IF NOT EXISTS `compliance_export_modules` (
    `export_id` BINARY(16) NOT NULL,
    `module_name` VARCHAR(50) NOT NULL, -- 'members', 'devices', 'audit'
    `item_count` INT DEFAULT 0,
    `status` ENUM('SUCCESS', 'SKIPPED', 'ERROR') DEFAULT 'SUCCESS',
    
    FOREIGN KEY (`export_id`) REFERENCES `compliance_exports`(`export_id`) ON DELETE CASCADE,
    INDEX `idx_export_mod` (`export_id`, `module_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
