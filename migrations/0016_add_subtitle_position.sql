-- 자막 위치 설정
ALTER TABLE users ADD COLUMN subtitle_position TEXT DEFAULT 'bottom';
ALTER TABLE users ADD COLUMN subtitle_bottom_offset INTEGER DEFAULT 80;
