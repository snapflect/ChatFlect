-- Migration: 006_add_signing_key.sql
-- Goal: Add column to store ECDSA Public Key for strict payload signing (Epic 5)

ALTER TABLE `user_devices`
ADD COLUMN `signing_public_key` TEXT DEFAULT NULL AFTER `public_key`;
