Logout Redirect Update

Change made:
- After any logged-in user clicks Logout, the app clears local auth/session data and redirects to the public Home page (/), not /login.

Test:
1. Login as student/admin/instructor/sub-admin.
2. Click Logout.
3. Expected: opens http://localhost:5173/ public home page.
4. Protected pages still require login.
