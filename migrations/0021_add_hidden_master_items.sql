-- 사용자별 숨긴 공용 영상 ID 저장 (JSON 배열)
ALTER TABLE users ADD COLUMN hidden_master_items TEXT DEFAULT '[]';
