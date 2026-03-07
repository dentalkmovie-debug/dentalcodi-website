-- 구독 관련 컬럼 추가
-- subscription_start: 구독 시작일
-- subscription_end: 구독 종료일
-- subscription_plan: 구독 플랜 (trial, monthly, yearly, unlimited)

ALTER TABLE users ADD COLUMN subscription_start TEXT;
ALTER TABLE users ADD COLUMN subscription_end TEXT;
ALTER TABLE users ADD COLUMN subscription_plan TEXT DEFAULT 'trial';
