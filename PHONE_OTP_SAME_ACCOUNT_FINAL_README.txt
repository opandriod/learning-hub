PHONE OTP SAME ACCOUNT FIX - FINAL

What this fixes:
1. Email-registered users can add a phone number in Profile.
2. Later, if they login using OTP with that same phone number, the app opens the SAME LMS account.
3. OTP login no longer creates a separate duplicate LMS account when that phone number already exists in public.users.
4. Register now stores public.users.auth_id correctly from Supabase Auth.

Important behavior:
- public.users.auth_id is the primary Supabase Auth id for the account.
- Phone OTP sessions are matched by phone number.
- If phone belongs to an existing email account, the same public.users row is returned.
- Existing auth_id is not overwritten by the separate phone Auth id.
- Phone number remains optional, but if present it should be unique.

After replacing files:
1. Restart Flask backend.
2. Restart Vite frontend.
3. Run phone_otp_same_account_final_migration.sql in Supabase SQL Editor.
4. Test:
   a) Register/login with email.
   b) Open Profile and add phone number, for example +9198798765177.
   c) Logout.
   d) Login with Mobile Number OTP using the same number.
   e) It should open the same account, not create a new account.

If old duplicate phone_...@learninghub.local rows exist:
- Run the optional cleanup section at the bottom of phone_otp_same_account_final_migration.sql only after checking the rows.
