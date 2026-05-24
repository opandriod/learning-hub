PHONE SAME ACCOUNT FIX

What changed:
- The backend now normalizes phone numbers before saving or searching.
- These all count as the same phone/account:
  8798765177
  08798765177
  918798765177
  +918798765177
  phone_918798765177@learninghub.local

What to do after replacing the project:
1. Open Supabase SQL Editor.
2. Run:
   learning_hub_backend/phone_same_account_migration.sql
3. Restart backend:
   cd learning_hub/learning_hub_backend
   python app.py
4. Restart frontend:
   cd learning_hub/learning-hub-frontend
   npm run dev

Result:
- If the user logs in by OTP using the same mobile number, the app will open the same LMS account.
- Old duplicate placeholder phone accounts will no longer steal the OTP login.
- Profile will display phone numbers in +91 format.
