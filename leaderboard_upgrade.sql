-- =====================================================
-- LEADERBOARD + DAILY QUIZ COOLDOWN UPGRADE
-- Run this in Supabase SQL Editor after quiz_mode_upgrade.sql.
-- Safe to run more than once.
-- =====================================================

-- Make sure the attempt table has the fields needed by leaderboard.
ALTER TABLE IF EXISTS quiz_mode_attempts
ADD COLUMN IF NOT EXISTS score_points INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS attempt_date_ist DATE,
ADD COLUMN IF NOT EXISTS week_start_ist DATE,
ADD COLUMN IF NOT EXISTS month_start_ist DATE;

-- Backfill date helper columns for older rows, if any.
UPDATE quiz_mode_attempts
SET
    attempt_date_ist = COALESCE(attempt_date_ist, (created_at AT TIME ZONE 'Asia/Kolkata')::date),
    week_start_ist = COALESCE(week_start_ist, date_trunc('week', created_at AT TIME ZONE 'Asia/Kolkata')::date),
    month_start_ist = COALESCE(month_start_ist, date_trunc('month', created_at AT TIME ZONE 'Asia/Kolkata')::date)
WHERE attempt_date_ist IS NULL
   OR week_start_ist IS NULL
   OR month_start_ist IS NULL;

ALTER TABLE IF EXISTS quiz_mode_attempts
ALTER COLUMN attempt_date_ist SET NOT NULL,
ALTER COLUMN week_start_ist SET NOT NULL,
ALTER COLUMN month_start_ist SET NOT NULL;

-- Leaderboard speed indexes.
CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_daily_today
ON quiz_mode_attempts(mode, attempt_date_ist, score_points DESC)
WHERE mode = 'daily';

CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_daily_week
ON quiz_mode_attempts(mode, week_start_ist, score_points DESC)
WHERE mode = 'daily';

CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_daily_month
ON quiz_mode_attempts(mode, month_start_ist, score_points DESC)
WHERE mode = 'daily';

CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_daily_user_created
ON quiz_mode_attempts(user_id, created_at DESC)
WHERE mode = 'daily';

-- Optional immediate cleanup. The backend also auto-deletes old attempts when leaderboard/quiz endpoints are used.
DELETE FROM quiz_mode_attempts
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '3 months';
