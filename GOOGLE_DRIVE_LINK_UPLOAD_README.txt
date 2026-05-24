Google Drive Link Upload Update

What changed:
- Admin Study Materials now supports either:
  1. Upload PDF file from device
  2. Paste Google Drive PDF link
- Admin Previous Year Questions now supports either:
  1. Upload PDF file from device
  2. Paste Google Drive PDF link

Important rules:
- Use either a local PDF file OR a Google Drive link, not both at the same time.
- Google Drive files must be shared as: Anyone with the link can view.
- Supported Google Drive formats include links like:
  https://drive.google.com/file/d/FILE_ID/view
  https://drive.google.com/open?id=FILE_ID

Why this helps:
- Mobile uploads from Google Drive can fail when using the normal Choose File button.
- Paste-link upload is easier and more reliable on phone.
- This is useful for admins/instructors managing PDF notes and old question papers.

No database migration is required because the existing file_url column stores the Google Drive view link.
