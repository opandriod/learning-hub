Razorpay Marketplace Checkout - Learning Hub

What this update adds:
1. Razorpay Checkout for paid Minor/Major project downloads.
2. Backend Razorpay order creation using Render environment variables.
3. Backend signature verification before unlocking downloads.
4. Automatic project_purchases status = approved after verified payment.
5. Automatic project_earnings record with default split:
   - uploader 70%
   - instructor 10%
   - platform remaining 20%
6. Manual UPI proof remains available as a backup.

Required environment variables:
Render backend:
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_test_secret

Vercel frontend:
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxx

Important:
- Use test keys first. They must start with rzp_test_ .
- Do not put RAZORPAY_KEY_SECRET in Vercel or frontend code.
- Run learning_hub_backend/razorpay_marketplace_upgrade.sql in Supabase before testing.
- Paid project price must be at least ₹50.

Test flow:
1. Add Render test keys and redeploy Render.
2. Add Vercel VITE_RAZORPAY_KEY_ID and redeploy Vercel.
3. Run the SQL migration.
4. Login as student.
5. Open Project Store.
6. Open a paid approved Minor/Major project.
7. Click Pay with Razorpay.
8. Complete test payment.
9. Download should unlock automatically.

Before real payments:
- Regenerate your live Razorpay key because it appeared in screenshots during setup.
- Switch both Render and Vercel to the new live keys only after test mode works.
