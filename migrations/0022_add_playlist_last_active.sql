-- 플레이리스트 마지막 활성 시간 (TV 접속 시간)
ALTER TABLE playlists ADD COLUMN last_active_at TEXT;
