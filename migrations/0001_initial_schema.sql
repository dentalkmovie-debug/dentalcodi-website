-- 사용자 테이블 (치과 계정 - admin_code로 식별)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_code TEXT UNIQUE NOT NULL,
  clinic_name TEXT DEFAULT '내 치과',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 플레이리스트 테이블
CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 플레이리스트 아이템 테이블 (동영상/이미지)
CREATE TABLE IF NOT EXISTS playlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('youtube', 'vimeo', 'image')),
  url TEXT NOT NULL,
  title TEXT,
  thumbnail_url TEXT,
  duration INTEGER DEFAULT 0,
  display_time INTEGER DEFAULT 10,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- 공지사항 테이블
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  position TEXT DEFAULT 'bottom',
  font_size INTEGER DEFAULT 24,
  text_color TEXT DEFAULT '#ffffff',
  bg_color TEXT DEFAULT '#000000',
  scroll_speed INTEGER DEFAULT 50,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_admin_code ON users(admin_code);
CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_short_code ON playlists(short_code);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_sort_order ON playlist_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_notices_user_id ON notices(user_id);
