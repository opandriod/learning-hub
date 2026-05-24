-- =====================================================
-- QUIZ MODE UPGRADE
-- Run this before using the new Daily / Rapid / Normal quiz flow.
-- =====================================================

-- 1) Separate daily quiz question bank
CREATE TABLE IF NOT EXISTS daily_quiz_questions (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer INTEGER NOT NULL CHECK (correct_answer BETWEEN 1 AND 4),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_quiz_questions_course_id ON daily_quiz_questions(course_id);
CREATE INDEX IF NOT EXISTS idx_daily_quiz_questions_unit_id ON daily_quiz_questions(unit_id);

-- 2) Attempt history table for all quiz modes
CREATE TABLE IF NOT EXISTS quiz_mode_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('daily', 'rapid', 'normal')),
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
    question_count INTEGER NOT NULL DEFAULT 0,
    attempted_count INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    not_attempted_count INTEGER NOT NULL DEFAULT 0,
    score_points INTEGER NOT NULL DEFAULT 0,
    time_limit_seconds INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    attempt_date_ist DATE NOT NULL,
    week_start_ist DATE NOT NULL,
    month_start_ist DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_user_id ON quiz_mode_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_mode ON quiz_mode_attempts(mode);
CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_created_at ON quiz_mode_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_attempt_date_ist ON quiz_mode_attempts(attempt_date_ist);
CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_week_start_ist ON quiz_mode_attempts(week_start_ist);
CREATE INDEX IF NOT EXISTS idx_quiz_mode_attempts_month_start_ist ON quiz_mode_attempts(month_start_ist);

-- 3) Allow only one Daily quiz attempt per user per IST day
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_quiz_one_per_day
ON quiz_mode_attempts(user_id, attempt_date_ist)
WHERE mode = 'daily';
