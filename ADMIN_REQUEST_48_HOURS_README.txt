Learning Hub - Admin Request 48 Hours Update

What changed:
1. Admin approval requests now expire after 48 hours instead of 2 minutes.
2. Instructor approval panel text now says 48 hours.
3. Backend register flow now creates admin_requests with expires_at = now + 48 hours.
4. Older admin_routes.py helper flow also uses 48 hours.
5. SQL migration included: learning_hub_backend/admin_request_48_hours_migration.sql

After extracting this zip:
1. Replace your existing project files with this version.
2. Run this SQL file in Supabase SQL Editor:
   learning_hub_backend/admin_request_48_hours_migration.sql
3. Restart backend:
   python app.py
4. Restart frontend:
   npm run dev

Test:
1. Register a user with Apply for Admin.
2. Open instructor panel.
3. Pending request should stay visible for 48 hours.
