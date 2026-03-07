-- 공지 위치 설정 추가 (상단/하단)
ALTER TABLE users ADD COLUMN notice_position TEXT DEFAULT 'bottom';
