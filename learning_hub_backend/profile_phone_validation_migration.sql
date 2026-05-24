-- =========================================================
-- Learning Hub Profile Phone Validation Migration
-- Purpose:
--   Stop fake/incorrect phone numbers from being saved from Profile update.
--   This is NOT a replacement for OTP ownership verification.
--   It only blocks obvious invalid formats/test numbers at database level.
-- =========================================================

-- 1) Make sure phone column exists.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone varchar(25);

-- 2) Normalize existing common Indian phone formats to +91XXXXXXXXXX.
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

-- 3) Function used by the check constraint.
CREATE OR REPLACE FUNCTION public.is_valid_indian_mobile_phone(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
  local10 text;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN true;
  END IF;

  digits := regexp_replace(p_phone, '\D', '', 'g');

  IF length(digits) = 11 AND digits LIKE '0%' THEN
    digits := substring(digits from 2);
  END IF;

  IF length(digits) = 12 AND digits LIKE '91%' THEN
    local10 := substring(digits from 3);
  ELSIF length(digits) = 10 THEN
    local10 := digits;
  ELSE
    RETURN false;
  END IF;

  IF length(local10) <> 10 THEN
    RETURN false;
  END IF;

  IF substring(local10 from 1 for 1) NOT IN ('6', '7', '8', '9') THEN
    RETURN false;
  END IF;

  IF local10 IN (
    '0000000000', '1111111111', '2222222222', '3333333333', '4444444444',
    '5555555555', '6666666666', '7777777777', '8888888888', '9999999999',
    '1234567890', '0123456789', '9876543210'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 4) Add a NOT VALID constraint.
-- NOT VALID means it will not break immediately if old bad test data exists,
-- but it WILL protect new inserts/updates going forward.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_phone_valid_indian_mobile_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
    ADD CONSTRAINT users_phone_valid_indian_mobile_check
    CHECK (public.is_valid_indian_mobile_phone(phone)) NOT VALID;
  END IF;
END $$;

-- 5) Find existing invalid phone values. If this returns rows, fix or clear them.
SELECT id, name, email, phone
FROM public.users
WHERE phone IS NOT NULL
  AND trim(phone) <> ''
  AND NOT public.is_valid_indian_mobile_phone(phone)
ORDER BY id DESC;

-- Optional cleanup for test data only:
-- UPDATE public.users
-- SET phone = NULL
-- WHERE phone IS NOT NULL
--   AND trim(phone) <> ''
--   AND NOT public.is_valid_indian_mobile_phone(phone);
