-- =========================================================
-- Learning Hub Phone OTP Same Account Final Migration
-- Run this in Supabase SQL Editor after replacing the project files.
-- =========================================================

-- 1) Required columns
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_id uuid;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone varchar(25);

ALTER TABLE public.users
ALTER COLUMN password_hash DROP NOT NULL;

-- 2) Link existing local users to Supabase Auth by email where possible
UPDATE public.users u
SET auth_id = au.id
FROM auth.users au
WHERE u.auth_id IS NULL
  AND u.email IS NOT NULL
  AND lower(u.email) = lower(au.email);

-- 3) Normalize Indian phone formats
UPDATE public.users
SET phone = CASE
  WHEN phone IS NULL OR trim(phone) = '' THEN NULL
  WHEN length(regexp_replace(phone, '\D', '', 'g')) = 10
    THEN '+91' || regexp_replace(phone, '\D', '', 'g')
  WHEN length(regexp_replace(phone, '\D', '', 'g')) = 11
       AND regexp_replace(phone, '\D', '', 'g') LIKE '0%'
    THEN '+91' || substring(regexp_replace(phone, '\D', '', 'g') from 2)
  WHEN length(regexp_replace(phone, '\D', '', 'g')) = 12
       AND regexp_replace(phone, '\D', '', 'g') LIKE '91%'
    THEN '+' || regexp_replace(phone, '\D', '', 'g')
  ELSE phone
END
WHERE phone IS NOT NULL;

-- 4) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_unique_not_null
ON public.users(auth_id)
WHERE auth_id IS NOT NULL;

-- 5) Email uniqueness when no duplicates exist
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
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON public.users (lower(email))
    WHERE email IS NOT NULL AND email <> '';
  ELSE
    RAISE NOTICE 'Skipped users_email_lower_unique because duplicate emails exist.';
  END IF;
END $$;

-- 6) Phone uniqueness when no duplicate normalized phone numbers exist
DO $$
DECLARE duplicate_count int;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT
      CASE
        WHEN length(regexp_replace(phone, '\D', '', 'g')) = 10
          THEN '91' || regexp_replace(phone, '\D', '', 'g')
        WHEN length(regexp_replace(phone, '\D', '', 'g')) = 11
             AND regexp_replace(phone, '\D', '', 'g') LIKE '0%'
          THEN '91' || substring(regexp_replace(phone, '\D', '', 'g') from 2)
        ELSE regexp_replace(phone, '\D', '', 'g')
      END AS phone_key
    FROM public.users
    WHERE phone IS NOT NULL AND trim(phone) <> ''
    GROUP BY 1
    HAVING COUNT(*) > 1
  ) d;

  IF duplicate_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_normalized_not_empty
    ON public.users ((
      CASE
        WHEN length(regexp_replace(phone, '\D', '', 'g')) = 10
          THEN '91' || regexp_replace(phone, '\D', '', 'g')
        WHEN length(regexp_replace(phone, '\D', '', 'g')) = 11
             AND regexp_replace(phone, '\D', '', 'g') LIKE '0%'
          THEN '91' || substring(regexp_replace(phone, '\D', '', 'g') from 2)
        ELSE regexp_replace(phone, '\D', '', 'g')
      END
    ))
    WHERE phone IS NOT NULL AND trim(phone) <> '';
  ELSE
    RAISE NOTICE 'Skipped phone unique index because duplicate phone numbers exist. Review duplicates below.';
  END IF;
END $$;

-- 7) Checks
SELECT id, auth_id, name, email, phone, role, status, semester_id
FROM public.users
ORDER BY id DESC
LIMIT 30;

SELECT
  CASE
    WHEN length(regexp_replace(phone, '\D', '', 'g')) = 10
      THEN '91' || regexp_replace(phone, '\D', '', 'g')
    WHEN length(regexp_replace(phone, '\D', '', 'g')) = 11
         AND regexp_replace(phone, '\D', '', 'g') LIKE '0%'
      THEN '91' || substring(regexp_replace(phone, '\D', '', 'g') from 2)
    ELSE regexp_replace(phone, '\D', '', 'g')
  END AS duplicate_phone_key,
  COUNT(*)
FROM public.users
WHERE phone IS NOT NULL AND trim(phone) <> ''
GROUP BY 1
HAVING COUNT(*) > 1;

-- =========================================================
-- OPTIONAL OLD DUPLICATE PHONE PLACEHOLDER CLEANUP
-- Only run this after you confirm the phone_...@learninghub.local rows are test/duplicate rows.
-- This does NOT delete quiz results. It only detaches the phone from old placeholder accounts.
-- =========================================================

/*
UPDATE public.users
SET phone = NULL,
    status = 'inactive'
WHERE lower(email) LIKE 'phone_%@learninghub.local';
*/
