ACADEMIC RESOURCES FEATURE ADDED
================================

This version adds:

1) Previous Year Questions
   - Admin uploads PDF only.
   - Fields: Semester, Subject, Year, Title, PDF file.
   - Students view/download previous year question PDFs.

2) Study Materials / Unit Notes
   - Admin uploads PDF only.
   - Fields: Semester, Subject, Unit, Title, Description, PDF file.
   - No topic selection. One PDF can cover the whole unit.
   - Students view/download unit-wise PDF notes.

3) Admin Project Upload Link
   - Admin now has a sidebar link: Upload Project ZIP.
   - It uses the existing marketplace upload route.
   - Admin/instructor uploads are auto-approved by the backend.
   - Sub-admin uploads still require review.

IMPORTANT SETUP STEPS
=====================

1) Run this SQL in Supabase SQL Editor:
   learning_hub_backend/academic_resources_migration.sql

2) Create this Supabase Storage bucket:
   Bucket name: academic-resources
   Public bucket: ON

3) Restart Flask backend:
   cd learning_hub_backend
   python app.py

4) Start frontend:
   cd learning-hub-frontend
   npm install
   npm run dev

NEW BACKEND FILES
=================

- learning_hub_backend/routes/academic_resources.py
- learning_hub_backend/academic_resources_migration.sql

UPDATED BACKEND FILES
=====================

- learning_hub_backend/app.py

NEW FRONTEND PAGES
==================

- src/pages/AdminStudyMaterials.jsx
- src/pages/AdminOldQuestions.jsx
- src/pages/StudyMaterials.jsx
- src/pages/PreviousQuestions.jsx

UPDATED FRONTEND FILES
======================

- src/App.jsx
- src/components/Sidebar.jsx

ROUTES ADDED
============

Admin:
- /admin/study-materials
- /admin/old-questions
- /admin/project-upload

Student/all logged-in users:
- /study-materials
- /previous-questions

API ROUTES ADDED
================

- GET    /api/academic/semesters
- GET    /api/academic/courses
- GET    /api/academic/units/<course_id>
- POST   /api/academic/study-materials
- GET    /api/academic/study-materials
- DELETE /api/academic/study-materials/<id>
- POST   /api/academic/old-questions
- GET    /api/academic/old-questions
- DELETE /api/academic/old-questions/<id>

NOTES
=====

- Only admin can upload/delete study materials and old question PDFs.
- Students can only see resources from their own semester.
- Admin can browse/upload for all semesters.
- PDF validation checks extension, empty file, max size, and real PDF header.
- Max PDF size default is 25 MB. You can change it with ACADEMIC_PDF_MAX_MB in .env.
- Bucket name default is academic-resources. You can change it with ACADEMIC_RESOURCES_BUCKET in .env.
