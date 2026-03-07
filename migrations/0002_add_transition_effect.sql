-- 플레이리스트에 전환 효과 설정 추가
ALTER TABLE playlists ADD COLUMN transition_effect TEXT DEFAULT 'fade';
ALTER TABLE playlists ADD COLUMN transition_duration INTEGER DEFAULT 500;
