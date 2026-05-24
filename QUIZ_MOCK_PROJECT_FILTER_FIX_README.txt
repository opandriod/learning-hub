QUIZ / MOCK TEST PROJECT FILTER FIX

What changed:
1. Minor Project and Major Project are now hidden from Practice Quiz subject selection.
2. Minor Project and Major Project are now hidden from Mock Test subject selection.
3. Backend mock test and quiz APIs also exclude Minor/Major Project courses for safety.
4. Topic/Unit final Start Quiz button now opens Quiz Setup instead of the old empty topic quiz page.
5. AI Chatbox is included in the Layout and backend route /api/ai/chat is registered.

Why:
Minor Project and Major Project are official BCA project papers, but they should not be treated as quiz/mock-test subjects. Students should use Project Store and course guidance for those.

After extracting:
- Backend: pip install -r requirements.txt, then python app.py
- Frontend: npm install, then npm run dev
- Add GEMINI_API_KEY and GEMINI_MODEL to backend .env if you want AI chatbox responses.
