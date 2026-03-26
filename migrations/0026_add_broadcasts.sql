-- 영상 배포 시스템: 마스터가 치과에 광고/영상을 배포
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 배포 정보
  title TEXT NOT NULL,
  description TEXT,
  
  -- 배포할 영상
  item_type TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  display_time INTEGER DEFAULT 10,
  
  -- 타겟팅
  target_mode TEXT NOT NULL DEFAULT 'all',
  target_user_ids TEXT DEFAULT '[]',
  target_playlist_type TEXT DEFAULT 'all',
  
  -- 배포 정책
  insert_position TEXT DEFAULT 'end',
  repeat_every_n INTEGER DEFAULT 0,
  is_mandatory INTEGER DEFAULT 1,
  auto_expire_at DATETIME,
  priority INTEGER DEFAULT 0,
  
  -- 상태
  status TEXT DEFAULT 'active',
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at);

-- 치과별 수신 상태
CREATE TABLE IF NOT EXISTS broadcast_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broadcast_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  playlist_id INTEGER,
  
  status TEXT DEFAULT 'auto_inserted',
  inserted_at DATETIME DEFAULT (datetime('now')),
  
  UNIQUE(broadcast_id, user_id),
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_receipts_user ON broadcast_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_receipts_broadcast ON broadcast_receipts(broadcast_id);
