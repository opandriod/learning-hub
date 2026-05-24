# Google and Mobile OTP Login Setup

This project now uses Supabase Auth for Google sign-in and mobile OTP. The frontend completes the Google/OTP login, then sends the Supabase session to the Flask backend. The backend creates/fetches the matching user in `public.users` and returns the normal Learning Hub JWT.

## 1. Frontend `.env`

Create `learning-hub-frontend/.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## 2. Backend `.env`

Add these values in `learning_hub_backend/.env`:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Keep your existing database values and `SECRET_KEY`.

## 3. Supabase Google provider

In Supabase Dashboard, go to Authentication > Providers > Google and enable Google. Add the Google client ID and client secret from Google Cloud.

In Google Cloud OAuth, add this authorized redirect URI:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

In Supabase Authentication > URL Configuration, add your frontend URL as an allowed redirect URL, for example:

```text
http://localhost:5173/login
```

## 4. Supabase Phone provider

In Supabase Dashboard, go to Authentication > Providers > Phone and enable Phone login. Configure an SMS provider such as Twilio, Vonage, MessageBird, or TextLocal.

Phone numbers should include a country code. The login page automatically converts Indian 10-digit numbers to `+91`.

## 5. Install and run

```bash
cd learning-hub-frontend
npm install
npm run dev
```

```bash
cd learning_hub_backend
python app.py
```
