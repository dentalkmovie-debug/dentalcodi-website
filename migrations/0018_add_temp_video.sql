-- 임시 영상 전송 기능을 위한 컬럼 추가
ALTER TABLE playlists ADD COLUMN temp_video_url TEXT;
ALTER TABLE playlists ADD COLUMN temp_video_title TEXT;
ALTER TABLE playlists ADD COLUMN temp_video_type TEXT;
ALTER TABLE playlists ADD COLUMN temp_return_time TEXT;
ALTER TABLE playlists ADD COLUMN temp_started_at DATETIME;
