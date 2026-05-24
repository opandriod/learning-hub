Editable Account Details Update

What changed:
1. Profile page now has an Edit button in Account Details.
2. Users can update their Name, Phone Number, and Email Address from Profile.
3. Phone OTP users no longer stay stuck as "Phone 91..." and "phone_...@learninghub.local".
4. If a user logs in with the same phone number again, the backend finds the same account using the stored phone column.
5. A migration file was added: learning_hub_backend/profile_phone_column_migration.sql

Recommended Supabase SQL:
Run this once if needed:

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(25);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);

Note:
The backend also tries to add the phone column automatically using ALTER TABLE IF NOT EXISTS when profile endpoints are used.
