Default Theme and CORS Fix

Changes included:
1. Light theme is now the default theme.
2. Existing users with old theme-normal/default will be migrated to light automatically.
3. Theme selector now shows Default, Dark, and Soft.
4. Backend CORS allows the live Vercel frontend and localhost by default, while still supporting FRONTEND_URL from Render.

Important deployment note:
In Render, keep FRONTEND_URL set to:
https://learning-hub-gules-one.vercel.app

If you add a custom domain later, set FRONTEND_URL to comma-separated values, for example:
https://learninghubbca.in,https://www.learninghubbca.in,https://learning-hub-gules-one.vercel.app
