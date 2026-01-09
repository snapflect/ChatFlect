-- Full Database Setup Script for SnapFlect Secure Chat
-- WARNING: This will DROP all existing tables and data.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop Existing Tables
DROP TABLE IF EXISTS otps;
DROP TABLE IF EXISTS status_views;
DROP TABLE IF EXISTS status_updates;
DROP TABLE IF EXISTS calls;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- 2. Create Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE, -- Public UUID
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NULL, -- Added for Phase 17
    public_key TEXT NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    photo_url TEXT,
    short_note TEXT,
    fcm_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Messages Table
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id VARCHAR(50) NOT NULL,
    receiver_id VARCHAR(50) NOT NULL, -- User UUID or Group UUID
    encrypted_content TEXT NOT NULL,
    iv TEXT, -- Initialization Vector
    type VARCHAR(20) DEFAULT 'text', -- text, image, video, audio, file, sticker
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_delivered TINYINT(1) DEFAULT 0,
    is_read TINYINT(1) DEFAULT 0,
    reply_to_id INT NULL,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. Create Groups Table
CREATE TABLE groups (
    id VARCHAR(50) PRIMARY KEY, -- Group UUID
    name VARCHAR(100) NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Group Members Table
CREATE TABLE group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    role VARCHAR(20) DEFAULT 'member', -- admin, member
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 6. Create Calls Table
CREATE TABLE calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    caller_id VARCHAR(50) NOT NULL,
    receiver_id VARCHAR(50) NOT NULL,
    type VARCHAR(10) NOT NULL, -- audio, video
    status VARCHAR(20) DEFAULT 'missed',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL
);

-- 7. Create Status Updates Table
CREATE TABLE status_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL, -- text, image, video
    text_content TEXT NULL,
    media_url TEXT NULL,
    background_color VARCHAR(20) DEFAULT '#000000',
    font VARCHAR(50) DEFAULT 'sans-serif',
    caption TEXT NULL,
    privacy VARCHAR(20) DEFAULT 'everyone',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP GENERATED ALWAYS AS (created_at + INTERVAL 24 HOUR) STORED,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 8. Create Status Views Table
CREATE TABLE status_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    viewer_id VARCHAR(50) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_view (status_id, viewer_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE
);

-- 9. Create OTPs Table (Phase 17)
CREATE TABLE otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    INDEX (phone_number)
);

-- 10. (Optional) Blocked Users Table?
-- Currently implemented in Firestore (Phase 5), but if we want SQL backup:
-- CREATE TABLE blocked_users (user_id VARCHAR(50), blocked_id VARCHAR(50), ...);
