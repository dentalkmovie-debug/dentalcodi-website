-- 사용자 테이블에 아임웹 관련 컬럼 추가
ALTER TABLE users ADD COLUMN imweb_member_id TEXT;
ALTER TABLE users ADD COLUMN imweb_email TEXT;

-- 아임웹 회원 ID로 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_imweb_member_id ON users(imweb_member_id);

-- 세션 테이블 생성
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 세션 토큰 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
