Razorpay Test Simulator Fix
===========================

What was added:
1. Backend endpoint:
   POST /api/marketplace/projects/:project_id/razorpay/test-success

2. Frontend hidden demo helper:
   The "Simulate Test Success" button appears only when Vercel has:
   VITE_ENABLE_TEST_PAYMENT_SIMULATOR=true

3. Backend protection:
   The simulator works only when Render has:
   ENABLE_TEST_PAYMENT_SIMULATOR=true
   and RAZORPAY_KEY_ID starts with rzp_test_

Use this only if Razorpay Test Mode keeps declining/timing out during the project demo.
For real launch, set both values to false or remove them.

Required Render env:
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
ENABLE_TEST_PAYMENT_SIMULATOR=true

Required Vercel env:
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxx
VITE_ENABLE_TEST_PAYMENT_SIMULATOR=true
VITE_API_BASE_URL=https://your-render-backend.onrender.com/api

After env changes:
- Redeploy Render backend
- Redeploy Vercel frontend with build cache OFF

Supabase check query:
select id, provider, status, amount, razorpay_order_id, razorpay_payment_id, paid_at, created_at
from project_purchases
order by created_at desc
limit 10;

Expected after real Razorpay success or simulator:
status = approved
razorpay_payment_id is not null
paid_at is not null
