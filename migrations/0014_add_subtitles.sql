-- 자막 테이블 생성
CREATE TABLE IF NOT EXISTS subtitles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_item_id INTEGER,
  vimeo_id TEXT,
  language TEXT DEFAULT 'ko',
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_subtitles_vimeo_id ON subtitles(vimeo_id);
CREATE INDEX IF NOT EXISTS idx_subtitles_playlist_item_id ON subtitles(playlist_item_id);
