REGISTER FAILED-TO-FETCH FIX

Fixed the mobile Create Account problem.

What was wrong:
- Register.jsx was still calling http://127.0.0.1:5000/api/auth/register.
- On a real phone/browser, 127.0.0.1 means the phone itself, not your Render backend.
- That is why the register page showed only "Failed to fetch".

What was fixed:
1. Register.jsx now uses the shared API helper from src/api/api.js.
2. The API helper supports VITE_API_BASE_URL for Vercel deployment.
3. If VITE_API_BASE_URL is missing in production, it falls back to:
   https://learning-hub-backend.onrender.com/api
4. Error messages are now clearer instead of only showing "Failed to fetch".
5. Unit PDF download was also changed from localhost to the deployed backend origin.

Important after uploading this zip to GitHub/Vercel:
- In Vercel project Settings > Environment Variables, add:
  VITE_API_BASE_URL=https://learning-hub-backend.onrender.com/api
- In Render backend Environment Variables, set FRONTEND_URL to:
  https://only-learninghub.site,https://www.only-learninghub.site
- Redeploy both frontend and backend after changing env variables.
