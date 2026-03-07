-- 사용자 활성화 상태 컬럼 추가
-- is_active: 1 = 활성, 0 = 정지
-- suspended_at: 정지된 시간
-- suspended_reason: 정지 사유

ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN suspended_at TEXT;
ALTER TABLE users ADD COLUMN suspended_reason TEXT;
