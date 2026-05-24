Learning Hub - Admin Panel Improvement

Updated parts:
1. Modern Admin Panel UI with better header, stats, quick actions, and recent users.
2. User search/filter by name, email, phone, role, status, and semester.
3. CSV export for filtered users.
4. Better protected action behavior: admins/instructors and the current user cannot be blocked from the panel.
5. Admin requests overview card added to the admin dashboard.
6. Backend /api/admin/users now returns auth_id, phone, and created_at.
7. Backend /api/admin/dashboard now returns instructor, active, blocked, and pending request counts.
8. Backend /api/admin/admin-requests returns a recent read-only request list for admins.

SQL:
No new SQL is required for this update. It uses your existing users and admin_requests tables.

After extracting:
1. Restart Flask backend: python app.py
2. Restart frontend: npm run dev
3. Login as an approved admin and open /admin
