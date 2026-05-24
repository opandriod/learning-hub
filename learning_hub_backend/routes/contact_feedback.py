from flask import Blueprint, request, jsonify
from datetime import datetime, timezone

contact_feedback_bp = Blueprint("contact_feedback", __name__)


def _safe_text(value, max_len=2000):
    return str(value or "").strip()[:max_len]


def _try_insert(table, fields):
    """Insert when optional support tables exist. Return False if DB/table is unavailable."""
    try:
        from db import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        columns = list(fields.keys())
        placeholders = ", ".join(["%s"] * len(columns))
        query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
        cur.execute(query, [fields[col] for col in columns])
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as exc:
        # The app should not fail if the optional table is not created yet.
        print(f"Optional insert into {table} skipped:", exc)
        return False


@contact_feedback_bp.route("/contact", methods=["POST"])
def contact_message():
    data = request.get_json(silent=True) or {}
    name = _safe_text(data.get("name"), 120)
    email = _safe_text(data.get("email"), 180)
    subject = _safe_text(data.get("subject"), 180)
    message = _safe_text(data.get("message"), 3000)

    if not name or not subject or not message:
        return jsonify({"error": "Name, subject, and message are required."}), 400

    saved = _try_insert("contact_messages", {
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "status": "open",
        "created_at": datetime.now(timezone.utc),
    })
    return jsonify({"message": "Contact message received.", "saved": saved}), 201


@contact_feedback_bp.route("/feedback", methods=["POST"])
def feedback_message():
    data = request.get_json(silent=True) or {}
    category = _safe_text(data.get("category"), 120) or "General feedback"
    message = _safe_text(data.get("message"), 3000)
    try:
        rating = int(data.get("rating") or 0)
    except Exception:
        rating = 0
    rating = max(1, min(rating, 5))

    if not message:
        return jsonify({"error": "Feedback message is required."}), 400

    saved = _try_insert("feedback_messages", {
        "rating": rating,
        "category": category,
        "message": message,
        "status": "open",
        "created_at": datetime.now(timezone.utc),
    })
    return jsonify({"message": "Feedback received.", "saved": saved}), 201
