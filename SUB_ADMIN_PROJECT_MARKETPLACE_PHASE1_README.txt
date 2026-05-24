Learning Hub - Sub-admin Project Marketplace Phase 1

This update adds the first complete version of the sub-admin + project marketplace system.

Run this SQL in Supabase SQL Editor first:
learning_hub_backend/sub_admin_marketplace_phase1_migration.sql

Backend settings to add in learning_hub_backend/.env:
LEARNING_HUB_UPI_ID=yourupi@bank
LEARNING_HUB_UPI_PAYEE=Learning Hub
PROJECT_UPLOADER_SHARE_PERCENT=70
SUB_ADMIN_MAX_ZIP_MB=50
ADMIN_MAX_ZIP_MB=200

New roles/permissions:
- Student: can apply for sub-admin, view/download/rate approved projects.
- Sub-admin: can upload project ZIPs only. Uploads are pending until reviewed.
- Admin: can review projects, verify payments, block/unblock students only.
- Instructor: can approve/reject admin requests, approve/reject sub-admin requests, review projects/payments, and block admins/sub-admins/students.

New pages:
/student side:
- /apply-sub-admin
- /projects

sub-admin:
- /sub-admin/projects

admin:
- /admin/project-review
- /admin/payments

instructor:
- /instructor/sub-admin-requests
- /instructor/project-review
- /instructor/payments

Phase 1 payment flow:
1. Paid project shows fixed-amount UPI QR/link.
2. User pays manually using GPay/PhonePe/Paytm/UPI.
3. User uploads screenshot + transaction ID.
4. Admin/instructor manually approves or rejects.
5. Approved payment unlocks download.
6. Earnings are recorded as 70% uploader share and 30% platform share by default.

ZIP upload validation:
- Only .zip allowed.
- ZIP must be at least 10 KB.
- ZIP must contain at least 3 files.
- ZIP must include README.txt or README.md.
- Blocks dangerous file extensions like .exe, .bat, .cmd, .vbs, .scr, .msi, .ps1, .sh.

Download limits:
- Free project: max 3 downloads per user per project.
- Paid project: max 5 downloads per approved buyer per project.
- Uploader can always access their own file.

Cleanup:
- Admin/instructor can archive projects manually.
- Admin/instructor can run auto-archive for approved projects older than 6 months with downloads < 50 and rating < 3.5.

Supabase Storage buckets needed:
- project-zips
- payment-proofs

Create them in Supabase Storage if they do not exist. For easiest testing, make them public buckets. For production, use private buckets + signed URLs later.

Pricing rule update:
- Practical/Lab resources are always free.
- Paid/manual UPI payment is available only for Semester 5 Minor Project and Semester 6 Major Project uploads.
- Reviewers cannot assign a price to practical/lab resources; they are approved as Free.
