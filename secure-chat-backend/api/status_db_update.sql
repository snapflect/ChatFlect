-- Status Feature Enterprise Optimization DB Script
-- Run this script in your MySQL/phpMyAdmin database

-- 1. Ensure Push Queue Table exists
CREATE TABLE IF NOT EXISTS push_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    payload TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'processing', 'failed', 'completed') DEFAULT 'pending',
    retry_count INT DEFAULT 0
);

-- 2. Ensure Views Table exists
CREATE TABLE IF NOT EXISTS status_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    viewer_id VARCHAR(50) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_view (status_id, viewer_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE
);

-- 3. Ensure Muted Statuses Table exists
CREATE TABLE IF NOT EXISTS muted_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    muted_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_mute (user_id, muted_user_id)
);

-- 4. Ensure Status Reactions Table exists
CREATE TABLE IF NOT EXISTS status_reactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    reaction VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_reaction (status_id, user_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE
);

-- 5. Ensure Status Replies Table exists
CREATE TABLE IF NOT EXISTS status_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reply_type ENUM('text', 'emoji', 'sticker') DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE
);

-- 6. Apply Missing Indexes for Cursor Pagination Performance
-- Note: If these already exist, MySQL will throw an error. You can safely ignore it.
ALTER TABLE status_updates ADD INDEX idx_status_created (created_at);
ALTER TABLE status_updates ADD INDEX idx_status_user_created (user_id, created_at);
