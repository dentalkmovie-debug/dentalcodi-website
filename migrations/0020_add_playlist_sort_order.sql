-- 플레이리스트에 정렬 순서 컬럼 추가
ALTER TABLE playlists ADD COLUMN sort_order INTEGER DEFAULT 0;
