-- =========================================================
-- Learning Hub BCA upload rules update
-- Practical/Lab resources + Minor/Major project uploads
-- Based on Mizoram University BCA course structure.
-- Run after sub_admin_marketplace_phase1_migration.sql.
-- =========================================================

ALTER TABLE public.project_uploads
ADD COLUMN IF NOT EXISTS subject_name TEXT;

ALTER TABLE public.project_uploads
DROP CONSTRAINT IF EXISTS project_uploads_project_type_check;

ALTER TABLE public.project_uploads
ADD CONSTRAINT project_uploads_project_type_check
CHECK (project_type IN ('practical', 'minor', 'major'));

-- Keep old rows safe if you tested earlier with simple type.
UPDATE public.project_uploads
SET project_type = 'practical'
WHERE project_type = 'simple';

-- Enforce syllabus-based combinations where possible.
ALTER TABLE public.project_uploads
DROP CONSTRAINT IF EXISTS project_uploads_bca_semester_type_check;

ALTER TABLE public.project_uploads
ADD CONSTRAINT project_uploads_bca_semester_type_check
CHECK (
  (project_type = 'practical' AND semester_id IN (1,2,3,4,5))
  OR (project_type = 'minor' AND semester_id = 5)
  OR (project_type = 'major' AND semester_id = 6)
);

CREATE INDEX IF NOT EXISTS idx_project_uploads_subject_name
ON public.project_uploads(subject_name);

SELECT id, title, semester_id, project_type, subject_name, status
FROM public.project_uploads
ORDER BY id DESC
LIMIT 20;

-- =========================================================
-- Pricing rule update
-- Practical/Lab resources must always be free.
-- Only Semester 5 Minor Project and Semester 6 Major Project can be paid.
-- =========================================================

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
