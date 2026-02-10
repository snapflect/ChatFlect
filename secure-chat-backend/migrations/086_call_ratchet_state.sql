-- 086_call_ratchet_state.sql
-- Epic 76: Ratchet State per Device

CREATE TABLE IF NOT EXISTS `call_ratchet_state` (
    `state_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `call_id` VARBINARY(32) NOT NULL,
    `user_id` INT NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `current_ratchet_counter` INT DEFAULT 0,
    `last_key_rotation_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uniq_ratchet` (`call_id`, `user_id`, `device_id`),
    FOREIGN KEY (`call_id`) REFERENCES `calls`(`call_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
