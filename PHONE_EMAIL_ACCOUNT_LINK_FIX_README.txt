PHONE + EMAIL ACCOUNT LINK FIX

What was wrong:
- Supabase Phone OTP accounts do not have a real email by default.
- The older code created a placeholder local email like phone_9187...@learninghub.local.
- If the same student later logged in with Google/email, the app could create a second local user instead of using the same account.

What is fixed:
1. Backend /auth/supabase-login now normalizes phone numbers.
   Example: 918798765177 and +918798765177 are treated as the same phone.

2. Phone OTP login now searches by:
   - canonical phone number (+91...)
   - older saved phone number without +
   - generated placeholder phone email

3. If there is both a real email account and an old placeholder phone account,
   the backend now prefers the real email account.

4. Profile edit now allows a real account to claim/link a phone number if that phone number
   only belongs to an old placeholder phone account.

How to use:
- Log in with the real email/Google account.
- Go to Profile > Account Details > Edit.
- Enter the phone number with country code, for example +918798765177.
- Save.
- Future OTP login with that phone number should open the same account.

Important:
- If the phone number is linked to another real user account, it will still be blocked.
- Only old placeholder accounts like phone_9187...@learninghub.local can be automatically detached.
