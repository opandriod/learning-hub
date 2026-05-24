Learning Hub Loading UX Update

Added professional loading improvements inspired by the shared UI videos:
- Reusable PageLoader, ButtonLoader, ThinkingDots, DashboardSkeleton, CoursePageSkeleton, QuizSetupSkeleton.
- Student dashboard skeleton now matches the professional student dashboard layout.
- Login buttons now show loading dots and a friendly server wake-up message after a few seconds.
- AI chat now shows "Learning Hub AI is thinking" with animated dots.
- Courses and quiz setup use richer skeleton loaders instead of plain text.
- Added payment processing modal styles for future Razorpay/payment flow.
- Kept secure backend fixes, /api/health, boto3 dependency, and npm registry config.

Before pushing:
cd learning-hub-frontend
npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
npm run build

Then push:
cd ..
git add .
git commit -m "Add professional loading UX"
git push
