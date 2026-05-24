Learning Hub Combined Update: Marketplace + AI Chatbox

This zip combines the latest marketplace/sub-admin/payment system with the Gemini AI Chatbox.

Added AI Chatbox files:
- learning_hub_backend/routes/ai_chat.py
- learning-hub-frontend/src/components/AiChatBox.jsx

Updated files:
- learning_hub_backend/app.py
- learning_hub_backend/requirements.txt
- learning_hub_backend/.env
- learning-hub-frontend/src/components/Layout.jsx
- learning-hub-frontend/src/App.css

Setup:
1. In learning_hub_backend/.env, set:
   GEMINI_API_KEY=your_real_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash

2. Install backend dependencies:
   pip install -r requirements.txt

3. Restart backend:
   python app.py

4. Restart frontend:
   npm run dev

AI route:
- POST /api/ai/chat
- Protected by JWT login

Notes:
- The AI assistant can explain BCA topics and LMS features.
- It does not change database records, payment status, attendance, grade, or admin data.
- For official profile/payment/admin issues, users should contact admin/support.
