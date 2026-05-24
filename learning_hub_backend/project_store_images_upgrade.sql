-- Project Store Google Play-style image/listing upgrade
-- Run this once in Supabase SQL Editor before using the new admin/instructor listing manager.

ALTER TABLE public.project_uploads
ADD COLUMN IF NOT EXISTS display_title TEXT,
ADD COLUMN IF NOT EXISTS display_description TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

UPDATE public.project_uploads
SET display_title = COALESCE(display_title, title),
    display_description = COALESCE(display_description, description)
WHERE display_title IS NULL OR display_description IS NULL;

CREATE TABLE IF NOT EXISTS public.project_images (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES public.project_uploads(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_path TEXT,
  image_type TEXT NOT NULL DEFAULT 'screenshot' CHECK (image_type IN ('thumbnail','screenshot')),
  position INT NOT NULL DEFAULT 1,
  uploaded_by INT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_images_project_id
ON public.project_images(project_id);

CREATE INDEX IF NOT EXISTS idx_project_uploads_featured_status
ON public.project_uploads(status, is_featured, approved_at DESC);

-- IMPORTANT SUPABASE STORAGE STEP:
-- Create a public storage bucket named: project-images
-- Dashboard -> Storage -> New bucket -> project-images -> Public bucket ON
-- The backend uploads thumbnails/screenshots into this bucket.
