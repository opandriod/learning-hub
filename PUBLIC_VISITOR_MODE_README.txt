PUBLIC VISITOR MODE UPDATE

What changed:
1. The website root route `/` now shows a public landing page instead of the login page.
2. Visitors can view the homepage/features preview without logging in.
3. Login is still required before opening protected app pages such as:
   - /courses
   - /dashboard
   - /syllabus
   - /practice-quiz
   - /mock-test
   - /projects
   - /profile
   - admin/instructor/sub-admin pages
4. If a visitor clicks a protected page, they are redirected to:
   /login?next=/requested-page
5. After login, students can be returned to the originally requested student/shared page when safe.
6. Admin/instructor/sub-admin users still go to their correct role dashboards.

Files changed:
- learning-hub-frontend/src/App.jsx
- learning-hub-frontend/src/components/ProtectedRoute.jsx
- learning-hub-frontend/src/pages/Login.jsx
- learning-hub-frontend/src/pages/PublicHome.jsx
- learning-hub-frontend/src/App.css

No new SQL is required.

Testing:
1. Open http://localhost:5173/ without login.
   Expected: public landing page appears.
2. Click View Courses Preview.
   Expected: redirected to login with message.
3. Login as student.
   Expected: redirected to requested page if safe, otherwise dashboard/setup.
4. Login as admin/instructor/sub_admin.
   Expected: redirected to correct role page.
