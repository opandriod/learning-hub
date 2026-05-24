from flask import Blueprint, request, jsonify
from db import get_db_connection
from middleware.auth_middleware import jwt_required, role_required
from utils.authz import require_lesson_access

notes_bp = Blueprint('notes', __name__)


# ✅ GET NOTES (for logged-in users)
@notes_bp.route('/notes/<int:lesson_id>', methods=['GET'])
@jwt_required
def get_notes(current_user, lesson_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        allowed, lesson_context = require_lesson_access(cur, current_user, lesson_id, require_enrollment=True)
        if not lesson_context:
            cur.close()
            conn.close()
            return jsonify({"error": "Lesson not found"}), 404
        if not allowed:
            cur.close()
            conn.close()
            return jsonify({"error": "Forbidden"}), 403

        cur.execute(
            """
            SELECT id, title, content, file_url, created_at, created_by
            FROM notes 
            WHERE lesson_id = %s 
            ORDER BY created_at DESC
            """,
            (lesson_id,)
        )

        notes = cur.fetchall()

        result = []
        for note in notes:
            result.append({
                "id": note[0],
                "title": note[1],
                "content": note[2],
                "file_url": note[3],
                "created_at": note[4],
                "created_by": note[5]  # 👈 NEW
            })

        cur.close()
        conn.close()

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 🔐 CREATE NOTE (ADMIN ONLY)
@notes_bp.route('/notes', methods=['POST'])
@jwt_required
@role_required("admin")
def create_note(current_user):
    try:
        data = request.json

        lesson_id = data.get('lesson_id')
        title = data.get('title')
        content = data.get('content')
        file_url = data.get('file_url')

        # 🔥 NEW: who created the note
        created_by = current_user["id"]

        if not lesson_id or not title:
            return jsonify({"error": "lesson_id and title required"}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO notes (lesson_id, title, content, file_url, created_by)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (lesson_id, title, content, file_url, created_by)
        )

        note_id = cur.fetchone()[0]
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Note created",
            "id": note_id
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 🔐 DELETE NOTE (ADMIN ONLY)
@notes_bp.route('/notes/<int:id>', methods=['DELETE'])
@jwt_required
@role_required("admin")
def delete_note(current_user, id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("DELETE FROM notes WHERE id = %s", (id,))
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"message": "Note deleted"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500