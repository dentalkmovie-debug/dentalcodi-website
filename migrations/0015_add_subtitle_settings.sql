-- 자막 스타일 설정 (마스터 사용자 테이블에 추가)
ALTER TABLE users ADD COLUMN subtitle_font_size INTEGER DEFAULT 28;
ALTER TABLE users ADD COLUMN subtitle_bg_opacity INTEGER DEFAULT 80;
ALTER TABLE users ADD COLUMN subtitle_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE users ADD COLUMN subtitle_bg_color TEXT DEFAULT '#000000';
