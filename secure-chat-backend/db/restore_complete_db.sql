-- ============================================================
-- ChatFlect COMPLETE Database Restore Script
-- Generated: 2026-01-16
-- purpose: Drops all existing tables and re-creates the entire schema
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. DROP EXISTING TABLES
DROP TABLE IF EXISTS status_replies;
DROP TABLE IF EXISTS status_reactions;
DROP TABLE IF EXISTS status_views;
DROP TABLE IF EXISTS muted_statuses;
DROP TABLE IF EXISTS status_updates;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS calls;
DROP TABLE IF EXISTS otps;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS blocked_users;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS contacts;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    short_note TEXT, -- Was 'about', matched to profile.php
    photo_url TEXT,
    public_key TEXT,
    fcm_token TEXT,
    is_online TINYINT(1) DEFAULT 0,
    last_seen TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- OTPs for Authentication
CREATE TABLE otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. CHAT FEATURES
-- ============================================================

-- Groups
CREATE TABLE groups (
    id VARCHAR(255) PRIMARY KEY, -- Client-generated UUID
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Group Members
CREATE TABLE group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_member (group_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Calls (Voice/Video)
CREATE TABLE calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    caller_id VARCHAR(255) NOT NULL,
    receiver_id VARCHAR(255) NOT NULL,
    type ENUM('audio', 'video') NOT NULL,
    status ENUM('initiated', 'ongoing', 'ended', 'missed', 'rejected') DEFAULT 'initiated',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (caller_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Blocked Users (Legacy/Future Compatibility)
CREATE TABLE blocked_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    blocked_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_block (user_id, blocked_user_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Messages (Legacy/Backup - Primary is Firebase)
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id VARCHAR(255) NOT NULL,
    receiver_id VARCHAR(255) NOT NULL,
    message TEXT,
    type ENUM('text', 'image', 'video', 'audio', 'file') DEFAULT 'text',
    status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contacts (Legacy/Sync)
CREATE TABLE contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    contact_user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255), -- Local name
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_contact (user_id, contact_user_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (contact_user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. STATUS TAB FEATURES (Phase 1-3)
-- ============================================================

-- Main status updates
CREATE TABLE status_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    type ENUM('text', 'image', 'video', 'audio') NOT NULL DEFAULT 'text',
    text_content TEXT,
    media_url VARCHAR(500),
    background_color VARCHAR(20) DEFAULT '#000000',
    font VARCHAR(50) DEFAULT 'sans-serif',
    caption TEXT,
    privacy ENUM('everyone', 'contacts', 'except') DEFAULT 'everyone',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Status views
CREATE TABLE status_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    viewer_id VARCHAR(255) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_view (status_id, viewer_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE,
    FOREIGN KEY (viewer_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Muted statuses
CREATE TABLE muted_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    muted_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_mute (user_id, muted_user_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (muted_user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Status reactions
CREATE TABLE status_reactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    reaction VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_reaction (status_id, user_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Status replies
CREATE TABLE status_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reply_type ENUM('text', 'emoji', 'sticker') DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
