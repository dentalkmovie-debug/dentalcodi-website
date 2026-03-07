-- Add sort_order to notices table for drag-and-drop ordering
ALTER TABLE notices ADD COLUMN sort_order INTEGER DEFAULT 0;
