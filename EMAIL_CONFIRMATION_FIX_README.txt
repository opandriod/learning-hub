EMAIL CONFIRMATION FIX ADDED

What was changed:
1. Frontend Register.jsx now blocks invalid email format like 123@123 or name@gmail.
2. Backend /api/auth/register also validates email format.
3. Backend registration now creates a matching Supabase Auth user, so Supabase can send the confirmation email when Confirm Email is enabled.
4. Backend /api/auth/login now checks Supabase auth.users.email_confirmed_at / confirmed_at. If the email is not confirmed, login is blocked.
5. Existing old local users that do not have a Supabase Auth row are allowed so old admin/student accounts do not suddenly break.

Required Supabase settings:
Authentication -> Sign In / Providers -> Email
- Enable email provider
- Enable Confirm Email / Email confirmations

Authentication -> URL Configuration:
- Site URL: http://localhost:5173
- Redirect URLs: http://localhost:5173/*

Backend .env:
FRONTEND_URL=http://localhost:5173

Important:
A fake but correctly formatted email like fake@gmail.com may still appear in Supabase Users and your local users table after registration. That is normal. The fix is that the account cannot log in until the email owner clicks the confirmation link.
