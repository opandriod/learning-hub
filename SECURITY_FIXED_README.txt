SECURITY FIXED VERSION - Learning Hub

Important: before deployment, rotate any secrets you pasted/shared previously:
- SUPABASE_SERVICE_ROLE_KEY
- DB_PASSWORD
- GEMINI_API_KEY
- SECRET_KEY
- Twilio tokens, if used

What was fixed in this zip:

1) Backend SECRET_KEY is no longer hardcoded
- app.py now requires SECRET_KEY from backend .env / Render environment variables.
- App startup fails if SECRET_KEY is missing.

2) Flask debug is no longer always enabled
- app.py now uses FLASK_DEBUG=1 only when you explicitly want debug locally.
- Production should use FLASK_DEBUG=0 or omit it.

3) CORS is restricted
- app.py now reads FRONTEND_URL from backend environment variables.
- For deployment, set FRONTEND_URL to your frontend URL.
- Example: FRONTEND_URL=https://your-site.vercel.app

4) Direct URL / ID guessing protection added
Server-side checks were added so students cannot open another semester/course content by changing IDs:
- /api/courses/<course_id>
- /api/courses/<course_id>/enroll
- /api/units/<course_id>
- /api/topics/<unit_id>
- /api/topics/detail/<topic_id>
- /api/topics/pdf/<topic_id>
- /generate-pdf/unit/<unit_id>
- /api/questions/topic/<topic_id>
- /api/questions/mini-topic/<topic_id>
- /api/questions/mini-topic/progress/<topic_id>
- /api/questions/mini-topic/submit
- /api/notes/<lesson_id>

5) Enrollment ownership fixed
Students can no longer update another user's progress by guessing enrollment_id:
- POST /api/progress/init/<enrollment_id>
- PUT /api/progress/update/<enrollment_id>

6) Mock-test answer leakage fixed
- GET /api/mock-test/<course_id> no longer returns is_correct.
- The frontend no longer calculates mock scores using hidden correct answers.
- POST /api/mock-test/submit now calculates score on the backend.
- Correct answers are returned only after submission for review.

7) Quiz answer leakage reduced
- /api/questions/quiz/start no longer sends correct_answer in question payload.
- /api/questions/mini-topic/<topic_id> no longer sends correct_answer in question payload.
- /api/questions/topic/<topic_id> no longer sends correct_answer by default.
- Quiz submission validates that submitted question IDs belong to the user's semester/selection.

8) Deprecated route files hardened
These files are not registered in app.py, but they are now protected if used later:
- routes/admin_routes.py
- routes/notes_routes.py
- routes/project_routes.py

After extracting:
1. Backend: copy learning_hub_backend/.env.example to learning_hub_backend/.env and fill real values.
2. Frontend: copy learning-hub-frontend/.env.example to learning-hub-frontend/.env and fill only VITE_* public values.
3. Never put backend private keys in frontend .env.
4. Run backend with python app.py or your deployment command.
5. Run frontend with npm install then npm run dev/build.

Important Supabase warning:
The frontend anon key is public by design. It is safe only if Supabase RLS policies are correct.
For production, enable RLS on tables that the frontend can directly access and never expose the service role key in frontend code.

Validation performed:
- Python backend files were checked with python -m py_compile.
- Frontend build was not run in this environment because node_modules/vite were not installed in the uploaded zip. Run npm install then npm run build locally.
