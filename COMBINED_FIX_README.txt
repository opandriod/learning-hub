Combined project notes:

1. This zip combines the newer uploaded project with the fixed inline sidebar search bar.
2. The search bar no longer opens a separate popup.
3. The search clear/cancel button stays on the left side as X.
4. The sidebar search scans visible content inside the current page and also suggests related pages.
5. PublicHome from the newer zip was kept.
6. Study Materials / Previous Questions pages from the fixed version were also kept and routed.

Recommended run steps:
Frontend:
cd learning-hub-frontend
npm install
npm run dev

Backend:
cd learning_hub_backend
pip install -r requirements.txt
python app.py
