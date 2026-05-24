PROFILE PHONE VALIDATION UPDATE

What this update fixes:
- Users cannot save obviously fake/wrong phone numbers from Profile update.
- Rejected examples: 999999, 0000000000, 1111111111, 1234567890, 9876543210.
- Accepted format: Indian mobile numbers stored as +91XXXXXXXXXX.
- Phone is still optional. Blank phone is allowed.
- This validation does not spend Twilio OTP money.

Important:
- Format validation only checks whether the phone looks realistic.
- OTP verification is still the only way to prove the user owns the phone number.
- For now, Profile update blocks fake numbers without sending OTP.

Files changed:
- learning_hub_backend/routes/auth.py
- learning-hub-frontend/src/pages/Profile.jsx
- learning_hub_backend/profile_phone_validation_migration.sql

After extracting:
1. Replace your project files with this version.
2. Restart backend: python app.py
3. Restart frontend: npm run dev
4. Run this SQL in Supabase SQL Editor:
   learning_hub_backend/profile_phone_validation_migration.sql

Test:
1. Login with a normal user.
2. Go to Profile.
3. Try phone: 999999 -> should reject.
4. Try phone: 0000000000 -> should reject.
5. Try phone: 9876543210 -> should reject.
6. Try a real-looking valid phone starting with 6/7/8/9 -> should save as +91XXXXXXXXXX if not already used by another account.
