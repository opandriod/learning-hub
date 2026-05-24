# Offline Backup Next Steps

Prepare this after the final polished project is pushed.

## Must prepare

1. Demo video showing the full online flow.
2. Screenshots of important pages.
3. Localhost frontend/backend run steps.
4. Supabase table screenshots/schema export.
5. Demo credentials written separately.
6. Backup PPT slides with all screens.

## Localhost frontend

```powershell
cd learning-hub-frontend
npm install
npm run dev
```

Frontend usually runs at:

```text
http://localhost:5173
```

## Localhost backend

```powershell
cd learning_hub_backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Backend usually runs at:

```text
http://localhost:5000
```

## Local env for frontend

```env
VITE_API_BASE_URL=http://localhost:5000
```

## Important limitation

Even with localhost frontend/backend, Supabase, Razorpay, Gemini AI, Google login, and Google Drive still require internet.
