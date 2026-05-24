Learning Hub update included in this package:

1. Default Light Theme + Custom Domain CORS
- Default theme remains the clean light/blue style.
- Backend CORS default origins now include:
  https://only-learninghub.site
  https://www.only-learninghub.site
  https://learning-hub-gules-one.vercel.app
  http://localhost:5173

2. Student Pages / UI Consistency
- Student utility pages now use the clean light dashboard background style.
- Mobile logout remains visible.
- Contact and Feedback pages were added.

3. Contact + Feedback
- Frontend pages:
  /contact
  /feedback
- Backend routes:
  POST /api/contact
  POST /api/feedback
- Optional SQL migration included:
  learning_hub_backend/contact_feedback_migration.sql

4. Streaks + Achievements
- Achievement panel added.
- Study streak is tracked per user in browser localStorage.
- Achievement-based accent colors:
  Blue: everyone
  Green: complete/start learning milestone
  Pink: complete 10 topics/lessons
  Purple: weekly top 3
  Gold: monthly top 3
- Profile photo upload unlocks after a 30-day streak.

5. Payment Gateway
- Razorpay/payment gateway was intentionally NOT added yet.

Deployment reminder:
- Push to GitHub.
- Vercel redeploys frontend.
- Render redeploys backend.
- In Render, set FRONTEND_URL to:
  https://only-learninghub.site,https://www.only-learninghub.site,https://learning-hub-gules-one.vercel.app,http://localhost:5173
