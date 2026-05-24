-- =========================================================
-- Learning Hub Admin Request Expiry Update
-- Purpose: change admin approval request expiry from 2 minutes to 48 hours.
-- Run this once in Supabase SQL Editor.
-- =========================================================

-- Update existing pending admin requests.
UPDATE public.admin_requests
SET expires_at = created_at + INTERVAL '48 hours'
WHERE status = 'pending';

-- If your project also has the older admin_applications table, update it too.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'admin_applications'
  ) THEN
    UPDATE public.admin_applications
    SET expires_at = created_at + INTERVAL '48 hours'
    WHERE status = 'pending';
  END IF;
END $$;

-- Optional default for future direct SQL inserts into admin_requests.
ALTER TABLE public.admin_requests
ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '48 hours');

-- Confirm latest requests.
SELECT id, user_id, status, created_at, expires_at, reviewed_at
FROM public.admin_requests
ORDER BY created_at DESC
LIMIT 20;
