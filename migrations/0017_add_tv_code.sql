-- TV 연결용 4자리 숫자 코드 추가
ALTER TABLE playlists ADD COLUMN tv_code TEXT;

-- tv_code 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_playlists_tv_code ON playlists(tv_code);
