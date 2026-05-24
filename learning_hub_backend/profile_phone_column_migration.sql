-- Run this once in Supabase SQL Editor if your users table does not have a phone column yet.
-- The updated backend also creates this column automatically, but running this is safer.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone VARCHAR(25);

CREATE INDEX IF NOT EXISTS idx_users_phone
ON public.users(phone);
