DASHBOARD SELECTED SEMESTER FIX

What was changed:
1. Student Dashboard now follows the semester saved in Profile.
2. /api/dashboard/student now reads users.semester_id first and returns only courses where courses.semester_id matches it.
3. Dashboard progress is calculated only from topics inside the selected semester courses.
4. /api/results now filters quiz results by the selected semester, so old quiz results from other semesters do not appear on the dashboard.
5. The empty dashboard message was updated to tell the user to change semester from Profile if needed.

How to test:
1. Login as a student.
2. Open Profile and select Semester 1, then click Save Semester.
3. Open Dashboard. Only Semester 1 courses/progress should appear.
4. Go back to Profile, select Semester 2, save, then reopen Dashboard. It should switch to Semester 2 courses only.
