-- 사용자 테이블에 로고 및 재생 시간 설정 추가
ALTER TABLE users ADD COLUMN logo_url TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN logo_size INTEGER DEFAULT 150;
ALTER TABLE users ADD COLUMN logo_opacity INTEGER DEFAULT 90;
ALTER TABLE users ADD COLUMN schedule_start TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN schedule_end TEXT DEFAULT '';
