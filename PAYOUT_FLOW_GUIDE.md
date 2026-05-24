# Project Store Payout Flow Guide

This guide explains the intended payout flow for the Project & Practical Store.

## Simple explanation

Only-Learning Hub collects project/resource payments through the platform first. After a successful purchase, the download is unlocked for the buyer and an earning record is created for the uploader/contributor. Payout is then handled manually by the instructor/platform owner.

## Current default share rule

The current backend defaults are:

- Uploader/contributor share: 70%
- Instructor/reviewer share: 10%
- Platform share: 20%

These values can be changed from backend environment variables:

```env
PROJECT_UPLOADER_SHARE_PERCENT=70
PROJECT_INSTRUCTOR_SHARE_PERCENT=10
```

The platform share is calculated automatically as the remaining amount.

Example for a project sold at ₹100:

- Uploader gets ₹70
- Instructor/reviewer gets ₹10
- Platform keeps ₹20

Example for a project sold at ₹50:

- Uploader gets ₹35
- Instructor/reviewer gets ₹5
- Platform keeps ₹10

## Payment flow

1. Student opens a paid project/resource.
2. Student pays using Razorpay Checkout.
3. Backend verifies the Razorpay payment signature.
4. Purchase status becomes approved.
5. Download is unlocked for the buyer.
6. A row is created in `project_earnings`.
7. The earning row stores uploader share, instructor share, platform share, and payout status.
8. Instructor/platform owner checks unpaid earnings.
9. Manual payout is sent to the uploader.
10. Payout status is updated/recorded as paid.

## Why payout is manual

Manual payout is safer for a BCA major project because it avoids complex marketplace compliance, bank integration, tax handling, and automatic settlement issues. Razorpay collects payment into the platform account, and the platform owner/instructor pays contributors later.

## Recommended payout policy for presentation

- Payout day: once a week, for example every Wednesday.
- Minimum payout: can be decided by admin/instructor.
- Payout method: manual UPI/bank transfer.
- Payout authority: instructor/platform owner only.
- Admin/sub-admin should not handle payout unless explicitly permitted.

## Examiner-friendly explanation

"The project store follows a platform-mediated payout model. When a student purchases a paid project, payment is collected through Razorpay and the download is unlocked after verification. The system records the contributor's share internally, while actual payout is handled manually by the instructor/platform owner. This is safer for an academic project because payment verification and download unlocking are automated, but financial settlement remains controlled."

## Tables involved

- `project_uploads`: stores uploaded resources/projects.
- `project_purchases`: stores purchase/payment status.
- `project_earnings`: stores uploader, instructor, and platform share.

## Important note

For the final college demo, use Razorpay Test Mode. Do not use real payment unless the project is ready for real launch and legal/financial policies are finalized.
