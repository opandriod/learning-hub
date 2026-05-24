-- =========================================================
-- Learning Hub Final Auth Migration
-- Run this once in Supabase SQL Editor before deployment.
-- Goal:
--   Supabase Auth = login/password/email reset/email confirmation
--   public.users = app profile/role/status/semester only
-- =========================================================

-- 1) Make public.users compatible with Supabase Auth.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_id uuid;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone varchar(25);

-- password_hash is no longer used for login. Keep it only for old data compatibility.
ALTER TABLE public.users
ALTER COLUMN password_hash DROP NOT NULL;

-- 2) Link old public.users rows to Supabase Auth rows by email where possible.
UPDATE public.users u
SET auth_id = au.id
FROM auth.users au
WHERE u.auth_id IS NULL
  AND u.email IS NOT NULL
  AND lower(u.email) = lower(au.email);

-- 3) Basic indexes.
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);

-- 4) A Supabase Auth user id must belong to only one LMS profile.
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_unique_not_null
ON public.users(auth_id)
WHERE auth_id IS NOT NULL;

-- 5) Email should be unique inside public.users.
-- This only creates the index when there are no duplicate emails.
DO $$
DECLARE duplicate_count int;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT lower(email)
    FROM public.users
    WHERE email IS NOT NULL AND email <> ''
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  ) d;

  IF duplicate_count = 0 THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON public.users (lower(email)) WHERE email IS NOT NULL AND email <> '''''';';
  ELSE
    RAISE NOTICE 'Skipped users_email_lower_unique because duplicate emails exist. Fix duplicates, then create the index.';
  END IF;
END $$;

-- 6) Normalize common Indian phone formats to +91XXXXXXXXXX.
UPDATE public.users
SET phone = CASE
  WHEN phone IS NULL OR trim(phone) = '' THEN NULL
  WHEN length(regexp_replace(phone, '\\D', '', 'g')) = 10
    THEN '+91' || regexp_replace(phone, '\\D', '', 'g')
  WHEN length(regexp_replace(phone, '\\D', '', 'g')) = 11
       AND regexp_replace(phone, '\\D', '', 'g') LIKE '0%'
    THEN '+91' || substring(regexp_replace(phone, '\\D', '', 'g') from 2)
  WHEN length(regexp_replace(phone, '\\D', '', 'g')) = 12
       AND regexp_replace(phone, '\\D', '', 'g') LIKE '91%'
    THEN '+' || regexp_replace(phone, '\\D', '', 'g')
  ELSE phone
END
WHERE phone IS NOT NULL;

-- 7) Phone should be unique when it is present.
-- This prevents duplicate OTP/account-recovery confusion.
-- This only creates the index when there are no duplicate normalized phone numbers.
DO $$
DECLARE duplicate_count int;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT
      CASE
        WHEN length(regexp_replace(phone, '\\D', '', 'g')) = 10
          THEN '91' || regexp_replace(phone, '\\D', '', 'g')
        WHEN length(regexp_replace(phone, '\\D', '', 'g')) = 11
             AND regexp_replace(phone, '\\D', '', 'g') LIKE '0%'
          THEN '91' || substring(regexp_replace(phone, '\\D', '', 'g') from 2)
        ELSE regexp_replace(phone, '\\D', '', 'g')
      END AS phone_key
    FROM public.users
    WHERE phone IS NOT NULL AND trim(phone) <> ''
    GROUP BY 1
    HAVING COUNT(*) > 1
  ) d;

  IF duplicate_count = 0 THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_normalized_not_empty
      ON public.users ((
        CASE
          WHEN length(regexp_replace(phone, ''\\D'', '''', ''g'')) = 10
            THEN ''91'' || regexp_replace(phone, ''\\D'', '''', ''g'')
          WHEN length(regexp_replace(phone, ''\\D'', '''', ''g'')) = 11
               AND regexp_replace(phone, ''\\D'', '''', ''g'') LIKE ''0%''
            THEN ''91'' || substring(regexp_replace(phone, ''\\D'', '''', ''g'') from 2)
          ELSE regexp_replace(phone, ''\\D'', '''', ''g'')
        END
      ))
      WHERE phone IS NOT NULL AND trim(phone) <> '''';
    ';
  ELSE
    RAISE NOTICE 'Skipped users_phone_unique_normalized_not_empty because duplicate phone numbers exist. Fix duplicates, then create the index.';
  END IF;
END $$;

-- 8) Check duplicate emails/phones manually after migration.
SELECT lower(email) AS duplicate_email, COUNT(*)
FROM public.users
WHERE email IS NOT NULL AND email <> ''
GROUP BY lower(email)
HAVING COUNT(*) > 1;

SELECT
  CASE
    WHEN length(regexp_replace(phone, '\\D', '', 'g')) = 10
      THEN '91' || regexp_replace(phone, '\\D', '', 'g')
    WHEN length(regexp_replace(phone, '\\D', '', 'g')) = 11
         AND regexp_replace(phone, '\\D', '', 'g') LIKE '0%'
      THEN '91' || substring(regexp_replace(phone, '\\D', '', 'g') from 2)
    ELSE regexp_replace(phone, '\\D', '', 'g')
  END AS duplicate_phone_key,
  COUNT(*)
FROM public.users
WHERE phone IS NOT NULL AND trim(phone) <> ''
GROUP BY 1
HAVING COUNT(*) > 1;

-- =========================================================
-- Instructor creation helper
-- 1. First create the instructor in Supabase Dashboard:
--    Authentication > Users > Add user
--    Email: instructor@gmail.com
--    Password: your password
--    Auto Confirm User: ON
-- 2. Then uncomment and run the block below.
-- =========================================================

/*
DO $$
DECLARE instructor_auth_id uuid;
DECLARE instructor_email text := 'instructor@gmail.com';
BEGIN
  SELECT id INTO instructor_auth_id
  FROM auth.users
  WHERE lower(email) = lower(instructor_email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF instructor_auth_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth user found for %. Create it in Authentication > Users first.', instructor_email;
  END IF;

  UPDATE public.users
  SET auth_id = instructor_auth_id,
      role = 'instructor',
      status = 'active',
      password_hash = NULL
  WHERE lower(email) = lower(instructor_email);

  IF NOT FOUND THEN
    INSERT INTO public.users (auth_id, name, email, role, status, password_hash)
    VALUES (instructor_auth_id, 'Instructor', instructor_email, 'instructor', 'active', NULL);
  END IF;
END $$;
*/
