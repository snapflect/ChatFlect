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
