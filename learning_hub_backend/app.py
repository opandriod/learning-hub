import os
from flask import Flask, send_file
from flask_cors import CORS

from routes.auth import auth_bp
from routes.courses import courses_bp
from routes.progress import progress_bp
from routes.lessons import lessons_bp
from routes.dashboard import dashboard_bp
from routes.notes import notes_bp
from routes.questions import questions_bp
from routes.results import results_bp
from routes.units import units_bp
from routes.topics import topics_bp
from routes.mock_test import mock_bp
from routes.admin import admin_bp
from routes.uploads import uploads_bp
from middleware.auth_middleware import jwt_required  # ✅ NEW
from utils.authz import require_unit_access
from routes.upload_routes import upload_bp
from routes.leaderboard import leaderboard_bp
from routes.marketplace import marketplace_bp
from routes.ai_chat import ai_chat_bp
from routes.academic_resources import academic_bp
from routes.contact_feedback import contact_feedback_bp

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import io

app = Flask(__name__)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "learning-hub-backend"}, 200


# ✅ CORS - restrict in production.
# Set FRONTEND_URL in Render to your frontend URL.
# Multiple URLs can be comma-separated, for example:
# FRONTEND_URL=https://learning-hub-gules-one.vercel.app,http://localhost:5173
frontend_urls = os.getenv("FRONTEND_URL", "")
default_allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://learning-hub-gules-one.vercel.app",
    "https://only-learninghub.site",
    "https://www.only-learninghub.site",
]
allowed_origins = []
for origin in frontend_urls.split(","):
    origin = origin.strip().rstrip("/")
    if origin and origin not in allowed_origins:
        allowed_origins.append(origin)
for origin in default_allowed_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    },
)

secret_key = os.getenv("SECRET_KEY")
if not secret_key:
    raise RuntimeError("SECRET_KEY is missing. Set it in your backend .env/Render environment variables.")
app.config["SECRET_KEY"] = secret_key

# =========================
# ✅ REGISTER BLUEPRINTS
# =========================
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(courses_bp, url_prefix="/api/courses")
app.register_blueprint(progress_bp, url_prefix="/api/progress")
app.register_blueprint(lessons_bp, url_prefix="/api/lessons")
app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
app.register_blueprint(notes_bp, url_prefix="/api")
app.register_blueprint(questions_bp, url_prefix="/api/questions")
app.register_blueprint(results_bp, url_prefix="/api")
app.register_blueprint(units_bp, url_prefix="/api/units")
app.register_blueprint(topics_bp, url_prefix="/api/topics")
app.register_blueprint(mock_bp, url_prefix="/api")
app.register_blueprint(admin_bp, url_prefix="/api/admin")
app.register_blueprint(uploads_bp, url_prefix="/api")
app.register_blueprint(upload_bp, url_prefix="/api")
app.register_blueprint(leaderboard_bp, url_prefix="/api/leaderboard")
app.register_blueprint(marketplace_bp, url_prefix="/api/marketplace")
app.register_blueprint(ai_chat_bp, url_prefix="/api/ai")
app.register_blueprint(academic_bp, url_prefix="/api")
app.register_blueprint(contact_feedback_bp, url_prefix="/api")

# =========================
# ✅ PDF FUNCTION
# =========================
def create_pdf(title, content):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)

    # Title
    p.setFont("Helvetica-Bold", 16)
    p.drawString(80, 750, title)

    y = 720

    for line in content.split("\n"):
        line = line.replace("■", "").replace("✏", "").strip()

        if not line:
            y -= 10
            continue

        # ✅ Heading detection
        if any(line.lower().startswith(k) for k in [
            "definition", "explanation", "types", "examples", "key points", "tip"
        ]):
            p.setFont("Helvetica-Bold", 12)
        else:
            p.setFont("Helvetica", 12)

        p.drawString(80, y, line)
        y -= 18

        # ✅ Page break
        if y < 50:
            p.showPage()
            y = 750
            p.setFont("Helvetica", 12)

    p.save()
    buffer.seek(0)
    return buffer

# =========================
# ✅ PDF ROUTE (SECURED)
# =========================
@app.route("/generate-pdf/unit/<int:unit_id>")
@jwt_required
def generate_pdf(current_user, unit_id):
    try:
        from db import get_db_connection

        conn = get_db_connection()
        cur = conn.cursor()

        allowed, unit_context = require_unit_access(cur, current_user, unit_id=unit_id, require_enrollment=True)
        if not unit_context:
            cur.close()
            conn.close()
            return {"error": "Unit not found"}, 404
        if not allowed:
            cur.close()
            conn.close()
            return {"error": "Forbidden"}, 403

        cur.execute("""
            SELECT title, content
            FROM topics
            WHERE unit_id = %s
            ORDER BY position
        """, (unit_id,))

        topics = cur.fetchall()

        cur.close()
        conn.close()

        if not topics:
            return {"error": "No topics found"}, 404

        # ✅ Build content
        full_content = f"UNIT {unit_id} NOTES\n\n"

        for i, topic in enumerate(topics, start=1):
            title, content = topic

            full_content += "\n\n==============================\n"
            full_content += f"{i}. {title.upper()}\n"
            full_content += "==============================\n\n"
            full_content += f"{content}\n\n"

        pdf = create_pdf(f"Unit {unit_id} Notes", full_content)

        return send_file(
            pdf,
            as_attachment=True,
            download_name=f"Unit_{unit_id}_Notes.pdf",
            mimetype="application/pdf"
        )

    except Exception as e:
        return {"error": str(e)}, 500

# =========================
# ✅ RUN APP
# =========================
if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1")
