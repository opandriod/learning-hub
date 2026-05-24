PERFORMANCE / DEPLOYMENT FIX

What changed:
1. Backend DB connections now use a connection pool instead of opening a new SSL connection for every request.
2. Dashboard fetches quiz results and progress in parallel.
3. AI chatbox is lazy-loaded so initial pages load lighter.
4. Frontend API has timeout and VITE_API_BASE_URL support for deployment.
5. Added /api/health route for deployment health checks.
6. Added SQL indexes for dashboard, auth, progress, marketplace, payments, and downloads.

Run this SQL once in Supabase SQL Editor:
learning_hub_backend/performance_indexes_and_deployment_fix.sql

Backend .env optional tuning:
DB_MINCONN=1
DB_MAXCONN=8
DB_CONNECT_TIMEOUT=5

Frontend deployment .env:
VITE_API_BASE_URL=https://your-backend-domain.com/api

Will deployment still load slowly?
- Free hosting can still have cold-start delays after the server sleeps.
- Supabase free/remote database can add network latency.
- This fix reduces repeated DB SSL handshakes and adds indexes, so normal page navigation should be faster.
