-- Mini Topic Quiz + Topic Progress migration
-- Run this once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.mini_topic_quiz_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    unit_id INTEGER REFERENCES public.units(id) ON DELETE SET NULL,
    course_id INTEGER REFERENCES public.courses(id) ON DELETE SET NULL,
    question_source TEXT NOT NULL DEFAULT 'quiz_questions_new',
    question_count INTEGER NOT NULL DEFAULT 5,
    attempted_count INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    score_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'needs_practice',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT mini_topic_quiz_attempts_status_check
        CHECK (status IN ('needs_practice', 'in_progress', 'completed'))
);

CREATE TABLE IF NOT EXISTS public.topic_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    unit_id INTEGER REFERENCES public.units(id) ON DELETE SET NULL,
    course_id INTEGER REFERENCES public.courses(id) ON DELETE SET NULL,
    mini_quiz_attempts INTEGER NOT NULL DEFAULT 0,
    best_score INTEGER NOT NULL DEFAULT 0,
    last_score INTEGER NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL DEFAULT 5,
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'not_started',
    completed_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, topic_id),
    CONSTRAINT topic_progress_status_check
        CHECK (status IN ('not_started', 'needs_practice', 'in_progress', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_mini_topic_quiz_attempts_user_topic
    ON public.mini_topic_quiz_attempts(user_id, topic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topic_progress_user_topic
    ON public.topic_progress(user_id, topic_id);

CREATE INDEX IF NOT EXISTS idx_topic_progress_user_course
    ON public.topic_progress(user_id, course_id);

-- If RLS is enabled by Supabase warning, these tables are still accessed by backend service role.
-- Keep client access through Flask APIs only.
