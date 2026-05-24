# Learning Hub deployment guide

## Recommended free stack

- Frontend: Vercel
- Backend: Render Python Web Service
- Database/Auth: Supabase
- Analytics: Umami Cloud first, or self-host later
- Monitoring: UptimeRobot
- Payments: Razorpay first for India/UPI; add Stripe or Dodo later for international SaaS

## Before GitHub

Do not upload real `.env` files. This deploy-ready zip removes `.env` files and keeps `.env.example`.

## 1. Replace your domain placeholders

After you choose a domain, replace this text everywhere in frontend files:

```txt
https://your-domain.com
```

Files to update:

- learning-hub-frontend/index.html
- learning-hub-frontend/public/robots.txt
- learning-hub-frontend/public/sitemap.xml
- learning-hub-frontend/public/llms.txt

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "Deploy Learning Hub"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## 3. Deploy backend on Render

Create a new Render Web Service.

Settings:

```txt
Root Directory: learning_hub_backend
Build Command: pip install -r requirements.txt
Start Command: gunicorn app:app
```

Add environment variables in Render:

```txt
DB_HOST=your_supabase_pooler_host
DB_NAME=postgres
DB_USER=your_supabase_db_user
DB_PASSWORD=your_supabase_db_password
DB_PORT=5432
SECRET_KEY=make_a_new_secret_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
FRONTEND_URL=https://your-vercel-domain.vercel.app
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
```

## 4. Deploy frontend on Vercel

Import the same GitHub repo.

Settings:

```txt
Root Directory: learning-hub-frontend
Build Command: npm run build
Output Directory: dist
```

Add environment variables in Vercel:

```txt
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=https://your-render-backend-url.onrender.com/api
```

## 5. Connect custom domain

Buy a short domain, then connect it to Vercel.

Good name ideas:

```txt
learninghubbca.in
bcalearninghub.in
studybca.in
mybcalearning.in
learninghubbca.com
```

For India/student trust, `.in` is fine. For SaaS/international later, `.com` is better.

## 6. Supabase auth settings

In Supabase:

```txt
Authentication -> URL Configuration
```

Set Site URL:

```txt
https://your-domain.com
```

Add Redirect URLs:

```txt
https://your-domain.com/**
https://your-vercel-domain.vercel.app/**
http://localhost:5173/**
```

## 7. Submit to Google

Go to Google Search Console.

Add property:

```txt
https://your-domain.com
```

Submit sitemap:

```txt
https://your-domain.com/sitemap.xml
```

Use URL Inspection for the home page and request indexing.

## 8. Add analytics

For Umami Cloud, create a website and copy the script. Add it before `</head>` in `learning-hub-frontend/index.html`:

```html
<script defer src="https://cloud.umami.is/script.js" data-website-id="YOUR_UMAMI_WEBSITE_ID"></script>
```

## 9. Add UptimeRobot

Create monitors for:

```txt
https://your-domain.com
https://your-render-backend-url.onrender.com/api/health
```

If you do not have `/api/health`, add a simple health route in Flask later.

## 10. Payments choice

Start with Razorpay for India because UPI is important for your users.

Use payment links/manual verification first. Add full checkout/webhook only after your LMS is stable.

## 11. After deployment changes

Every update is:

```bash
git add .
git commit -m "Update"
git push
```

Vercel and Render will redeploy automatically.
