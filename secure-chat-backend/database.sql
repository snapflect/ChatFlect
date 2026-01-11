-- Database: secure_chat_db (Or whatever name you choose in Hostinger)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE, -- The public-facing ID (e.g. hash of phone)
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    short_note VARCHAR(150),
    photo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contacts Table (To sync phone numbers)
-- In a real app, you might just query 'users' by phone number array
-- But explicitly linking can rely on this table if we add 'friend requests' later.
-- For Phase 1, we just query 'users' table directly for simplicity.

-- Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(255),
    created_by VARCHAR(50) NOT NULL, -- references users(user_id)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Group Members Table
CREATE TABLE IF NOT EXISTS group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(50) NOT NULL, -- references groups(group_id)
    user_id VARCHAR(50) NOT NULL, -- references users(user_id)
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_membership (group_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Status Updates Table
CREATE TABLE IF NOT EXISTS status_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_id VARCHAR(50) NOT NULL UNIQUE,
    user_id VARCHAR(50) NOT NULL,
    type VARCHAR(20) DEFAULT 'image',
    content_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
