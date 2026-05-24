-- Optional cleanup for older phone-login rows.
-- Run this in Supabase SQL Editor after replacing the project files.
-- It does NOT delete users. It only normalizes phone numbers and detaches phone
-- from placeholder rows when the same phone is already linked to a real email account.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone VARCHAR(25);

-- Normalize Indian 10-digit numbers to +91 format.
UPDATE public.users
SET phone = '+91' || phone
WHERE phone ~ '^[6-9][0-9]{9}$';

-- Normalize numbers saved as 91XXXXXXXXXX to +91XXXXXXXXXX.
UPDATE public.users
SET phone = '+' || phone
WHERE phone ~ '^91[0-9]{10}$';

-- If a placeholder phone account and a real email account share the same phone,
-- detach the phone from the placeholder account so the real account owns it.
WITH placeholder AS (
  SELECT
    id,
    email,
    ('+' || substring(lower(email) from '^phone_([0-9]+)@learninghub\.local$')) AS canonical_phone
  FROM public.users
  WHERE lower(email) ~ '^phone_[0-9]+@learninghub\.local$'
)
UPDATE public.users p
SET phone = NULL
FROM placeholder ph
WHERE p.id = ph.id
  AND EXISTS (
    SELECT 1
    FROM public.users real_user
    WHERE real_user.id <> p.id
      AND real_user.phone = ph.canonical_phone
      AND lower(real_user.email) NOT LIKE 'phone_%@learninghub.local'
  );

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
