APP-LIKE MOBILE UI UPDATE

Included in this version:
- Mobile bottom navigation: Home, Courses, Quiz, Rewards, Profile.
- Dashboard reduced to app-style previews instead of one very long page.
- Continue Learning now shows only the first 2 enrolled courses on dashboard; full list stays on Courses page.
- Achievements moved to its own /achievements screen.
- Dashboard now shows only a compact Study Rewards preview.
- AI button is moved above the bottom navigation on mobile and made smaller.
- Mobile cards, headings, buttons, course cards, stats, and achievement cards are more compact.
- Existing fixes preserved: default light theme, CORS domain support, contact/feedback, academic routes, mobile logout, health route, boto3 dependency, dashboard semester filter, and mock test mobile layout fixes.

Test before deployment:
cd learning-hub-frontend
npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
npm run build

Deployment:
cd ..
git init
git remote add origin https://github.com/opandriod/learning-hub.git
git branch -M main
git add .
git commit -m "Make mobile UI app-like"
git fetch origin main
git push --force-with-lease=main:origin/main -u origin main

Redeploy Render only if backend deploy does not auto-start. Vercel should redeploy automatically.
