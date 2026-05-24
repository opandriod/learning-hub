# Learning Hub LMS Backend

## Overview

This project is a Learning Management System (LMS) backend built using:

- Python Flask
- PostgreSQL (Supabase)
- JWT Authentication
- Role-Based Access Control

The system allows administrators to create courses and lessons while students can enroll, complete lessons, and track progress.

---

# System Features

- User authentication (register/login)
- Role-based access (admin / student)
- Course management
- Student enrollment
- Lesson creation
- Lesson completion tracking
- Course progress tracking
- Student dashboard

---

# API Endpoints

| Endpoint | Method | Description |
|--------|--------|--------|
| `/auth/register` | POST | Register new user |
| `/auth/login` | POST | Login user |
| `/courses` | GET | Get all courses |
| `/courses/create` | POST | Admin creates course |
| `/courses/enroll/<course_id>` | POST | Student enroll in course |
| `/courses/<course_id>` | GET | Get single course details |
| `/lessons/<course_id>/lessons` | GET | Get lessons in course |
| `/lessons/courses/<course_id>/lessons` | POST | Admin creates lesson |
| `/lessons/<lesson_id>` | GET | Get lesson content |
| `/lessons/<lesson_id>/complete` | POST | Mark lesson as completed |
| `/lessons/<lesson_id>` | DELETE | Admin deletes lesson |
| `/progress/course/<course_id>` | GET | Get course progress |
| `/dashboard/student` | GET | Student dashboard |

---

# Learning Workflow

1. User registers or logs in
2. Admin creates courses
3. Admin adds lessons
4. Student enrolls in course
5. Student views lessons
6. Student completes lessons
7. System calculates course progress
8. Dashboard displays learning progress

---

# Database Tables

The system uses the following main tables:

- users
- courses
- enrollments
- lessons
- lesson_completions
- progress

---

# Technology Stack

Backend:
- Python
- Flask
- PostgreSQL

Authentication:
- JWT Tokens

Database Hosting:
- Supabase

---

# Future Improvements

Possible future features include:

- Quiz system
- Certificates
- Discussion forums
- Video progress tracking
- Course ratings
# LMS Admin Approval + PDF Notes + Project ZIP Package

This package adds:

- admin application workflow with 2-minute instructor approval window
- PDF note uploads by approved admins
- ZIP uploads for project/minor-project courses by approved admins
- React components for applying, reviewing, and uploading

## Included

- `sql/001_admin_applications.sql`
- `sql/002_project_files.sql`
- `sql/003_notes_alter.sql`
- `backend/supabase_client.py`
- `backend/admin_routes.py`
- `backend/notes_routes.py`
- `backend/project_routes.py`
- `backend/app_register_example.py`
- `frontend/components/ApplyAdminButton.jsx`
- `frontend/components/AdminApplicationsPage.jsx`
- `frontend/components/UploadNoteForm.jsx`
- `frontend/components/UploadProjectZipForm.jsx`

## Assumptions

- Backend: Flask
- Database: Supabase Postgres
- Existing `users` table has a `role` column with values like `student`, `instructor`, `admin`
- Existing `courses`, `units`, and `notes` tables exist
- Supabase Storage buckets to create manually:
  - `notes-pdfs`
  - `project-zips`

## Setup order

1. Run the SQL files in order.
2. Create the two storage buckets in Supabase.
3. Add the backend route files to your Flask app.
4. Add the React components where needed.

## Recommended flow

- Student clicks **Apply for Admin**.
- A pending request is created with `expires_at = now + 48 hours`.
- Instructor approves before timeout.
- If approved, user role changes to `admin`.
- If not approved in time, request is marked `rejected`.
- Approved admins can upload:
  - PDF notes to `notes`
  - ZIP files for project courses to `project_files`

## Notes table

This package reuses your existing `notes` table. The SQL adds missing columns only if they do not already exist.
