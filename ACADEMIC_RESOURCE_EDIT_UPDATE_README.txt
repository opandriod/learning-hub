Academic Resource Edit Update

This update adds Edit support for uploaded academic PDFs.

Updated pages:
- Admin Study Materials
- Admin Previous Year Questions

New abilities:
- Edit title/name after upload
- Edit description for study materials
- Edit year for previous year questions
- Replace the existing PDF with a new device PDF
- Replace the existing PDF with a Google Drive PDF link
- Keep the current PDF when only editing text

Permissions:
- Admin and instructor can edit/delete academic resources.
- Sub-admin can edit/delete resources they uploaded.
- Students can only view/download resources.

Backend routes added:
- PATCH /api/academic/study-materials/:id
- PATCH /api/academic/old-questions/:id

Mobile upload improvement:
- PDF validation now checks real PDF header and accepts application/pdf MIME type, making phone uploads more reliable.
