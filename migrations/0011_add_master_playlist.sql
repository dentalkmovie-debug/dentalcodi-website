-- 마스터 관리자 시스템
-- 1. 마스터 관리자 여부 플래그
ALTER TABLE users ADD COLUMN is_master INTEGER DEFAULT 0;

-- 2. 사용자가 마스터 플레이리스트를 사용할지 여부
ALTER TABLE users ADD COLUMN use_master_playlist INTEGER DEFAULT 1;

-- 3. 마스터 플레이리스트 우선순위 (before: 마스터 먼저, after: 마스터 나중, only: 마스터만)
ALTER TABLE users ADD COLUMN master_playlist_mode TEXT DEFAULT 'before';

-- 4. 플레이리스트에 마스터 여부 플래그
ALTER TABLE playlists ADD COLUMN is_master_playlist INTEGER DEFAULT 0;
