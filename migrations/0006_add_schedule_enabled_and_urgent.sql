-- 재생시간 사용 여부 추가
ALTER TABLE users ADD COLUMN schedule_enabled INTEGER DEFAULT 0;

-- 공지사항에 긴급공지 여부 추가
ALTER TABLE notices ADD COLUMN is_urgent INTEGER DEFAULT 0;
