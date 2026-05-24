LOGIN LIGHT THEME + REGISTER FETCH FIX

What is fixed in this version:
1. Register page uses the shared API client instead of hard-coded localhost, so deployed/mobile registration will not call 127.0.0.1.
2. Login page dark background has been changed to a clean light mode design.
3. Login card, inputs, divider, remember me text, alert messages, Google button, and Back to Home button were recolored for light mode readability.
4. Build was tested successfully after installing frontend dependencies locally.

Deployment reminder:
Frontend Vercel environment variable:
VITE_API_BASE_URL=https://learning-hub-backend.onrender.com/api

Backend Render environment variable:
FRONTEND_URL=https://only-learninghub.site,https://www.only-learninghub.site

After changing environment variables, redeploy frontend and backend.
