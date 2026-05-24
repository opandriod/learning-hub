Dashboard Topic Progress Fix

This update fixes the Student Dashboard progress cards so they use the new Mini Topic Quiz progress system.

What changed:
1. /api/dashboard/student now counts total topics from courses -> units -> topics.
2. It reads student progress from public.topic_progress.
3. Dashboard no longer shows 0 / 0 when topics exist.
4. It shows:
   - Courses
   - Topics Completed
   - Topics Attempted
   - Overall Progress
5. Course cards now show completed / total topics, attempted topics, and progress percentage.
6. Progress still updates only after a Mini Topic Quiz is submitted.

No new SQL is required if mini_topic_quiz_progress_migration.sql was already run.
