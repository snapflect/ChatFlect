-- 041_audit_log_partitioning.sql
-- HF-51.8: Partition Audit Log by Month
-- REQUIRES: Table rebuild (ALTER TABLE)
-- WARNING: This operation locks the table. Schedule during maintenance window.

-- 1. Must ensure Primary Key includes Partition Key (created_at)
-- This usually requires dropping existing PK and adding composite PK

ALTER TABLE `security_audit_log` 
DROP PRIMARY KEY,
ADD PRIMARY KEY (`audit_id`, `created_at`);

-- 2. Apply Partitioning
ALTER TABLE `security_audit_log`
PARTITION BY RANGE ( YEAR(created_at)*100 + MONTH(created_at) ) (
    PARTITION p_start VALUES LESS THAN (202501),
    PARTITION p_202501 VALUES LESS THAN (202502),
    PARTITION p_202502 VALUES LESS THAN (202503),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

