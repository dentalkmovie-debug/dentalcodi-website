-- Add logo_position column to users table (left/right positioning)
ALTER TABLE users ADD COLUMN logo_position TEXT DEFAULT 'right';
