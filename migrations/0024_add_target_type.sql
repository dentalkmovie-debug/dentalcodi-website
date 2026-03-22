-- 공용 영상에 대기실/체어 구분 추가 (all=전체, waitingroom=대기실전용, chair=체어전용)
ALTER TABLE playlist_items ADD COLUMN target_type TEXT DEFAULT 'all';
