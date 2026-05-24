PROJECT STORE IMAGE/LISTING UPGRADE

What was added:
1. Admin/Instructor can manage the final product listing details.
2. Admin/Instructor can upload product thumbnail image.
3. Admin/Instructor can upload multiple project screenshots.
4. Student store cards now show a product image like Google Play Store.
5. Project details page now shows a screenshot gallery before download/payment.
6. Sub-admin/student uploader still uploads ZIP/basic request only; final store display is controlled by Admin/Instructor.

Before running:
1. In Supabase SQL Editor, run:
   learning_hub_backend/project_store_images_upgrade.sql

2. In Supabase Storage, create a PUBLIC bucket named:
   project-images

3. Deploy backend and frontend again.

Where to manage images:
Admin/Instructor Panel -> Resource Review -> Manage Listing

Recommended image rule:
- 1 thumbnail image
- 2 to 5 screenshots
- JPG, PNG, JPEG, WEBP
- Max 5 MB per image
