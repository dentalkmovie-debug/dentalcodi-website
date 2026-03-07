-- 사용자 테이블에 공지 스타일 설정 추가 (공통 설정)
ALTER TABLE users ADD COLUMN notice_font_size INTEGER DEFAULT 32;
ALTER TABLE users ADD COLUMN notice_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE users ADD COLUMN notice_bg_color TEXT DEFAULT '#1a1a2e';
ALTER TABLE users ADD COLUMN notice_scroll_speed INTEGER DEFAULT 50;
