-- ============================================================
-- ChatFlect Status Tab - Complete Database Schema
-- Generated: 2026-01-16
-- ============================================================

-- Main status updates table (should already exist)
CREATE TABLE IF NOT EXISTS status_updates (
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
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Status views tracking
CREATE TABLE IF NOT EXISTS status_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    viewer_id VARCHAR(255) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_view (status_id, viewer_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE,
    INDEX idx_status_id (status_id),
    INDEX idx_viewer_id (viewer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Muted statuses (to hide status updates from specific users)
CREATE TABLE IF NOT EXISTS muted_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    muted_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_mute (user_id, muted_user_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Status reactions (emoji reactions to statuses)
CREATE TABLE IF NOT EXISTS status_reactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    reaction VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_reaction (status_id, user_id),
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE,
    INDEX idx_status_id (status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Status replies (text/emoji replies to statuses)
CREATE TABLE IF NOT EXISTS status_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reply_type ENUM('text', 'emoji', 'sticker') DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (status_id) REFERENCES status_updates(id) ON DELETE CASCADE,
    INDEX idx_status_id (status_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- NOTES:
-- 1. All tables use InnoDB for foreign key support
-- 2. Charset is utf8mb4 to support emojis
-- 3. The status.php API auto-creates tables if they don't exist
-- 4. Foreign keys cascade on delete for data integrity
-- ============================================================
