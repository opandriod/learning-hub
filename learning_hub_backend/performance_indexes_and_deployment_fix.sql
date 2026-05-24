-- Learning Hub performance/deployment helper indexes
-- Safe to run multiple times in Supabase SQL Editor.

-- Auth/profile/session lookups
CREATE INDEX IF NOT EXISTS idx_users_id_status_role ON public.users(id, status, role);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_lower_email ON public.users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_semester_id ON public.users(semester_id);

-- Dashboard progress lookups
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course ON public.enrollments(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_units_course_id ON public.units(course_id);
CREATE INDEX IF NOT EXISTS idx_topics_unit_id ON public.topics(unit_id);
CREATE INDEX IF NOT EXISTS idx_topic_progress_user_topic ON public.topic_progress(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_progress_user_course ON public.topic_progress(user_id, course_id);

-- Quiz result display
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_created ON public.quiz_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_test_results_user_created ON public.mock_test_results(user_id, created_at DESC);

-- Marketplace/project store lookups
CREATE INDEX IF NOT EXISTS idx_project_uploads_status_approved ON public.project_uploads(status, approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_uploads_sem_type_status ON public.project_uploads(semester_id, project_type, status);
CREATE INDEX IF NOT EXISTS idx_project_purchases_access ON public.project_purchases(project_id, buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_project_purchases_transaction_id ON public.project_purchases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_project_downloads_project_user ON public.project_downloads(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_project_ratings_project_user ON public.project_ratings(project_id, user_id);
