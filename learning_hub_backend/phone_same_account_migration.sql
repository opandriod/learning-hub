-- PHONE SAME ACCOUNT MIGRATION
-- Run this once in Supabase SQL Editor.
--
-- Goal:
-- Treat the same phone number as the same LMS account even if it was saved as:
--   8798765177
--   08798765177
--   918798765177
--   +918798765177
--   phone_918798765177@learninghub.local
--
-- The script:
-- 1. Adds users.phone if missing.
-- 2. Converts phone values to canonical +91XXXXXXXXXX style when possible.
-- 3. If duplicate rows have the same phone, keeps the best real account and clears
--    the duplicate placeholder phone values so future OTP login opens only one account.
-- 4. Adds a unique index so two rows cannot keep the exact same normalized phone.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone varchar(25);

-- Fill phone from old generated local emails like phone_918798765177@learninghub.local
UPDATE public.users
SET phone = '+' || substring(lower(email) from '^phone_([0-9]+)@learninghub\.local$')
WHERE (phone IS NULL OR phone = '')
  AND lower(email) ~ '^phone_[0-9]+@learninghub\.local$';

-- Canonicalize Indian phone formats.
UPDATE public.users
SET phone = CASE
  WHEN length(regexp_replace(phone, '\D', '', 'g')) = 10
    THEN '+91' || regexp_replace(phone, '\D', '', 'g')
  WHEN length(regexp_replace(phone, '\D', '', 'g')) = 11
       AND regexp_replace(phone, '\D', '', 'g') LIKE '0%'
    THEN '+91' || substring(regexp_replace(phone, '\D', '', 'g') from 2)
  ELSE '+' || regexp_replace(phone, '\D', '', 'g')
END
WHERE phone IS NOT NULL
  AND phone <> ''
  AND regexp_replace(phone, '\D', '', 'g') <> '';

-- Clear duplicate phone values from lower-priority rows.
-- Priority:
--   1. Real email account first
--   2. Generated phone placeholder account after
--   3. Lowest id first as tie breaker
WITH ranked AS (
  SELECT
    id,
    phone,
    regexp_replace(phone, '\D', '', 'g') AS phone_digits,
    ROW_NUMBER() OVER (
      PARTITION BY regexp_replace(phone, '\D', '', 'g')
      ORDER BY
        CASE WHEN lower(email) LIKE 'phone_%@learninghub.local' THEN 1 ELSE 0 END,
        id ASC
    ) AS rn
  FROM public.users
  WHERE phone IS NOT NULL
    AND phone <> ''
    AND regexp_replace(phone, '\D', '', 'g') <> ''
)
UPDATE public.users u
SET phone = NULL
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;

-- This prevents exact normalized duplicate phone values going forward.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_not_null
ON public.users (phone)
WHERE phone IS NOT NULL AND phone <> '';

-- Helpful check after running:
-- SELECT id, name, email, phone FROM public.users WHERE phone IS NOT NULL ORDER BY phone, id;
