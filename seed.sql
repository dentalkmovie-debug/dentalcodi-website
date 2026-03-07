-- 테스트 사용자 (admin_code로 식별)
INSERT OR IGNORE INTO users (id, admin_code, clinic_name) VALUES 
  (1, 'demo1234', '데모 치과'),
  (2, 'test5678', '테스트 치과');

-- 테스트 플레이리스트
INSERT OR IGNORE INTO playlists (id, user_id, name, short_code) VALUES 
  (1, 1, '대기실 TV', 'abc123'),
  (2, 1, '진료실 TV', 'def456'),
  (3, 2, '메인 TV', 'ghi789');

-- 테스트 플레이리스트 아이템
INSERT OR IGNORE INTO playlist_items (playlist_id, item_type, url, title, thumbnail_url, sort_order) VALUES 
  (1, 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '치아 관리 안내', 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 1),
  (1, 'youtube', 'https://www.youtube.com/watch?v=9bZkp7q19f0', '구강 건강 팁', 'https://img.youtube.com/vi/9bZkp7q19f0/hqdefault.jpg', 2);

-- 테스트 공지사항
INSERT OR IGNORE INTO notices (user_id, content, is_active, position) VALUES 
  (1, '오늘 진료 예약은 02-1234-5678로 문의해주세요. 점심시간 12:00~13:00', 1, 'bottom');
