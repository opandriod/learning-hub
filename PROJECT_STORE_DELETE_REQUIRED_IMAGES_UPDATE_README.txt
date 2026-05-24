Project Store Update: Required Images, Minimum Price, Inline Details, Delete Rules

What changed:
1. Admin, instructor, and sub-admin upload form now requires:
   - ZIP file
   - Thumbnail image
   - Minimum 3 project screenshots
2. Paid Minor/Major projects now require a minimum price of ₹50.
3. Instructor can delete any project.
4. Admin and sub-admin can delete only projects they personally uploaded.
5. Project Store details now expand inside the clicked product card instead of opening as a separate details section below the whole list.
6. Admin review approval checks that a project has a thumbnail and at least 3 screenshots before approval.

Important:
- No new SQL is required if you already ran project_store_images_upgrade.sql.
- Supabase Storage public bucket project-images is still required.
- Supabase Storage bucket project-zips is still required.

Push command:
git add .
git commit -m "Require project images and add owner delete rules"
git push origin main
