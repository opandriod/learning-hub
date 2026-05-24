-- =========================================================
-- Learning Hub Phase 1 Marketplace + Sub-admin Migration
-- Manual UPI QR payment, project approval, ratings, upload limits.
-- Run once in Supabase SQL Editor.
-- =========================================================

-- Sub-admin requests: student applies, instructor approves/rejects.
CREATE TABLE IF NOT EXISTS public.sub_admin_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  skills TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  review_note TEXT,
  reviewed_by INT REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_admin_requests_user_id ON public.sub_admin_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_admin_requests_status ON public.sub_admin_requests(status);

-- Project uploads/repository.
CREATE TABLE IF NOT EXISTS public.project_uploads (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  semester_id INT REFERENCES public.semesters(id) ON DELETE SET NULL,
  course_id INT REFERENCES public.courses(id) ON DELETE SET NULL,
  project_type TEXT NOT NULL DEFAULT 'practical' CHECK (project_type IN ('practical','minor','major')),
  subject_name TEXT,
  uploaded_by INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','archived','deleted')),
  is_paid BOOLEAN NOT NULL DEFAULT false,
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  download_count INT NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  approved_by INT REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  reviewed_by INT REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_note TEXT,
  archived_at TIMESTAMP,
  delete_after TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_uploads_status ON public.project_uploads(status);
CREATE INDEX IF NOT EXISTS idx_project_uploads_uploaded_by ON public.project_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_project_uploads_semester_type ON public.project_uploads(semester_id, project_type);

-- Project ratings: one rating per user per project; user can update.
CREATE TABLE IF NOT EXISTS public.project_ratings (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES public.project_uploads(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_ratings_project_id ON public.project_ratings(project_id);

-- Download logs for per-user limits and popularity.
CREATE TABLE IF NOT EXISTS public.project_downloads (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES public.project_uploads(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_downloads_project_user ON public.project_downloads(project_id, user_id);

-- Manual UPI purchases/payment proofs.
CREATE TABLE IF NOT EXISTS public.project_purchases (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES public.project_uploads(id) ON DELETE CASCADE,
  buyer_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'UPI',
  transaction_id TEXT NOT NULL,
  screenshot_url TEXT NOT NULL,
  screenshot_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by INT REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_project_purchases_status ON public.project_purchases(status);
CREATE INDEX IF NOT EXISTS idx_project_purchases_buyer_project ON public.project_purchases(buyer_id, project_id);

-- Earnings for manual payout tracking.
CREATE TABLE IF NOT EXISTS public.project_earnings (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES public.project_uploads(id) ON DELETE CASCADE,
  purchase_id INT NOT NULL REFERENCES public.project_purchases(id) ON DELETE CASCADE,
  uploader_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  uploader_share NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_share NUMERIC(10,2) NOT NULL DEFAULT 0,
  payout_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payout_status IN ('unpaid','paid')),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_earnings_uploader ON public.project_earnings(uploader_id);

-- Optional safety checks / current status.
SELECT role, COUNT(*) FROM public.users GROUP BY role ORDER BY role;
SELECT status, COUNT(*) FROM public.project_uploads GROUP BY status ORDER BY status;

-- BCA syllabus-based upload rules update.
ALTER TABLE public.project_uploads
ADD COLUMN IF NOT EXISTS subject_name TEXT;

ALTER TABLE public.project_uploads
DROP CONSTRAINT IF EXISTS project_uploads_project_type_check;

ALTER TABLE public.project_uploads
ADD CONSTRAINT project_uploads_project_type_check
CHECK (project_type IN ('practical', 'minor', 'major'));

ALTER TABLE public.project_uploads
DROP CONSTRAINT IF EXISTS project_uploads_bca_semester_type_check;

ALTER TABLE public.project_uploads
ADD CONSTRAINT project_uploads_bca_semester_type_check
CHECK (
  (project_type = 'practical' AND semester_id IN (1,2,3,4,5))
  OR (project_type = 'minor' AND semester_id = 5)
  OR (project_type = 'major' AND semester_id = 6)
);

-- Pricing rule: Practical/Lab resources must be free; only Minor/Major projects can be paid.
UPDATE public.project_uploads
SET is_paid = false,
    price = 0
WHERE project_type = 'practical';

ALTER TABLE public.project_uploads
DROP CONSTRAINT IF EXISTS project_uploads_practical_free_check;

ALTER TABLE public.project_uploads
ADD CONSTRAINT project_uploads_practical_free_check
CHECK (
  (project_type = 'practical' AND is_paid = false AND price = 0)
  OR (project_type IN ('minor', 'major'))
);
