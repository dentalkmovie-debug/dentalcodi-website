-- Add active_item_ids column to playlists table
-- Stores JSON array of item IDs that are active in the playlist
-- null = not yet configured (empty playlist), '[]' = explicitly empty, '[1,2,3]' = specific items
ALTER TABLE playlists ADD COLUMN active_item_ids TEXT DEFAULT NULL;
