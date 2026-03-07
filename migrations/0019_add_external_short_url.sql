-- 플레이리스트에 외부 단축 URL 컬럼 추가
ALTER TABLE playlists ADD COLUMN external_short_url TEXT;
