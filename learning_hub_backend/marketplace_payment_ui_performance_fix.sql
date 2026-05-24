-- Optional performance/index cleanup for Project Marketplace Phase 1.
-- Safe to run multiple times.

CREATE INDEX IF NOT EXISTS idx_project_uploads_status_approved
ON public.project_uploads (status, approved_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_uploads_store_filters
ON public.project_uploads (status, semester_id, project_type);

CREATE INDEX IF NOT EXISTS idx_project_purchases_project_buyer_status
ON public.project_purchases (project_id, buyer_id, status);

CREATE INDEX IF NOT EXISTS idx_project_downloads_project_user
ON public.project_downloads (project_id, user_id);

CREATE INDEX IF NOT EXISTS idx_project_ratings_project_user
ON public.project_ratings (project_id, user_id);
