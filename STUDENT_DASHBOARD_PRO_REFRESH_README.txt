STUDENT DASHBOARD PROFESSIONAL UI REFRESH

Updated files:
- learning-hub-frontend/src/pages/Dashboard.jsx
- learning-hub-frontend/src/App.css

What changed:
- Rebuilt the student dashboard into a clean LMS/SaaS style.
- Added a clear welcome section and Today’s Focus card.
- Added compact professional stat cards.
- Reworked Continue Learning into cleaner course cards.
- Added Study Tools quick actions.
- Added Recent Performance section.
- Kept Default, Light, and Dark theme support through existing CSS variables.
- Improved mobile layout so dashboard content is cleaner and the sidebar becomes a horizontal compact nav.
- Reduced heavy decorative glass/orb effects inside the student dashboard.
- Adjusted AI floating button size/spacing on mobile.

After extracting:
1. cd learning-hub-frontend
2. npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
3. npm run build
4. git add .
5. git commit -m "Refresh student dashboard UI"
6. git push

Note:
The backend security fixes, health route, .npmrc, and boto3 dependency are preserved in this zip.
