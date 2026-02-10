-- 046_partition_buckets.sql
-- Epic 52 Hardening: Partition Rate Limit Buckets
-- Optimizes high-write bucket table by partitioning on bucket_key hash.
-- Note: MySQL requires partitioning key to be part of Primary Key.

-- 1. Drop existing PK if needed (Assuming bucket_key is PK)
-- ALTER TABLE `rate_limit_buckets` DROP PRIMARY KEY;

-- 2. Add HASH Partitioning (Simple distribution)
ALTER TABLE `rate_limit_buckets`
PARTITION BY KEY(bucket_key)
PARTITIONS 16;
