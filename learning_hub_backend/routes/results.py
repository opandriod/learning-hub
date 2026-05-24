from flask import Blueprint, request, jsonify
from db import get_db_connection
from middleware.auth_middleware import jwt_required

results_bp = Blueprint('results', __name__)

# ================= SAVE QUIZ RESULT =================
@results_bp.route('/results', methods=['POST'])
@jwt_required
def save_result(current_user):
    try:
        data = request.json

        lesson_id = data.get("lesson_id")
        score = data.get("score")
        total = data.get("total")

        # 🔴 VALIDATION
        if lesson_id is None or score is None or total is None:
            return jsonify({"error": "Missing fields"}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # 🔥 Check existing result
        cur.execute("""
            SELECT id FROM quiz_results
            WHERE user_id = %s AND lesson_id = %s
        """, (current_user["id"], lesson_id))

        existing = cur.fetchone()

        if existing:
            # UPDATE
            cur.execute("""
                UPDATE quiz_results
                SET score = %s, total = %s, created_at = CURRENT_TIMESTAMP
                WHERE user_id = %s AND lesson_id = %s
            """, (score, total, current_user["id"], lesson_id))
        else:
            # INSERT
            cur.execute("""
                INSERT INTO quiz_results (user_id, lesson_id, score, total)
                VALUES (%s, %s, %s, %s)
            """, (current_user["id"], lesson_id, score, total))

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"message": "Result saved"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ================= GET MY RESULTS =================
@results_bp.route('/results', methods=['GET'])
@jwt_required
def get_my_results(current_user):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT 
                r.lesson_id,
                r.score,
                r.total,
                r.created_at,
                l.title AS lesson_title,
                c.title AS course_title
            FROM quiz_results r
            JOIN lessons l ON r.lesson_id = l.id
            JOIN courses c ON l.course_id = c.id
            WHERE r.user_id = %s
            ORDER BY r.created_at DESC
        """, (current_user["id"],))

        rows = cur.fetchall()

        data = []

        for row in rows:
            data.append({
                "lesson_id": row[0],
                "score": row[1],
                "total": row[2],
                "percentage": round((row[1] / row[2]) * 100, 2) if row[2] else 0,
                "created_at": row[3],
                "lesson_title": row[4],
                "course_title": row[5]
            })

        cur.close()
        conn.close()

        return jsonify(data), 200

    except Exception as e:
        print("RESULTS ERROR:", e)  # 🔥 important for debugging
        return jsonify({"error": str(e)}), 500

    