-- Add notice_enabled column to users table
ALTER TABLE users ADD COLUMN notice_enabled INTEGER DEFAULT 1;
