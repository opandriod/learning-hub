Mock test mobile + dashboard semester fix

Changes:
- Mock test attempt page now stacks correctly on mobile; the progress/sidebar no longer overlaps the question.
- Mock test setup form has cleaner mobile spacing and friendlier unit loading message.
- Student dashboard backend now only returns enrolled courses from the user's selected semester when semester_id is set.
- Dashboard frontend also filters any returned courses by semester_id as a safety layer.

After deployment:
- Redeploy Render because learning_hub_backend/routes/dashboard.py changed.
- Vercel will redeploy frontend automatically after GitHub push.
