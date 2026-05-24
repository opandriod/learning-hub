EMAIL CONFIRMATION LOGIN FIX

Problem fixed:
The old email login checked only the local PostgreSQL users table. Because of that, a user could register with an unconfirmed Supabase email and still log in with the normal email/password form.

What changed:
Backend route learning_hub_backend/routes/auth.py now verifies email/password with Supabase Auth before issuing the Learning Hub JWT token.

Now the flow is:
1. User registers.
2. Supabase sends the confirmation email.
3. User cannot log in until the confirmation link is clicked.
4. If the email is not confirmed, login returns:
   "Please confirm your email before logging in. Check your inbox or spam folder."

Important:
- Restart the Flask backend after replacing the files.
- Clear old browser login tokens if you were already logged in:
  DevTools -> Application -> Local Storage -> clear token/role/name/semester_id
  or simply log out once.
- Existing old users that were created before Supabase Auth may need to register again or be created inside Supabase Auth.

Supabase settings needed:
Authentication -> Sign In / Providers -> Email -> Confirm email ON
Authentication -> URL Configuration -> Site URL: http://localhost:5173
Authentication -> URL Configuration -> Redirect URLs: http://localhost:5173 and http://localhost:5173/login
